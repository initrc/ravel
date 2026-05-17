import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readConfig } from "./config.js";
import { readSession, deleteSession } from "../models/session.js";
import { updateTaskStatus } from "../models/task.js";
import { git } from "./git.js";

const execFileAsync = promisify(execFile);

export type IntegrationEvent =
  | { type: "progress"; taskId: string; message: string }
  | { type: "conflict"; taskId: string; message: string }
  | { type: "test-failure"; taskId: string; message: string; output: string }
  | { type: "error"; taskId: string; message: string }
  | { type: "complete"; taskId: string };

export type IntegrationCallback = (event: IntegrationEvent) => void;

async function hasUncommittedChanges(cwd: string): Promise<boolean> {
  const out = await git(["status", "--porcelain"], cwd);
  return out.trim().length > 0;
}

export async function runIntegration(
  taskId: string,
  projectRoot: string,
  onEvent: IntegrationCallback,
): Promise<void> {
  const config = readConfig(projectRoot);
  const session = readSession(projectRoot, taskId);
  if (!session) {
    throw new Error(`No session found for task ${taskId}`);
  }

  const worktreeDir = path.resolve(projectRoot, session.worktreePath);
  const branch = session.branch;
  const mainBranch = config.mainBranch;
  const taskFilePath = path.join(projectRoot, "ravel", "tasks", `${branch}.md`);

  // 1. Stash uncommitted changes on main so they don't interfere with the rebase.
  const dirty = await hasUncommittedChanges(projectRoot);
  if (dirty) {
    onEvent({
      type: "progress",
      taskId,
      message: `Stashing uncommitted changes on ${mainBranch}...`,
    });
    await git(["stash", "push", "--include-untracked"], projectRoot);
    onEvent({
      type: "progress",
      taskId,
      message: "Stashed uncommitted changes",
    });
  }

  // 2. Wait for the "done" commit to land on the feature branch. The file
  // watcher fires on the task-status file write, which can happen before
  // the agent's git commit completes. Poll until the worktree is clean.
  if (await hasUncommittedChanges(worktreeDir)) {
    onEvent({
      type: "progress",
      taskId,
      message: "Waiting for commit to land on feature branch...",
    });
    const timeoutMs = 300_000;
    const intervalMs = 2000;
    const start = Date.now();
    while (await hasUncommittedChanges(worktreeDir)) {
      if (Date.now() - start >= timeoutMs) {
        throw new Error(
          `Timed out waiting for commit to land on feature branch. ` +
          `The worktree still has uncommitted changes after ${timeoutMs / 1000}s.`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  // 3. Rebase onto the local main branch.
  onEvent({
    type: "progress",
    taskId,
    message: `Rebasing onto ${mainBranch}...`,
  });
  try {
    await git(["rebase", mainBranch], worktreeDir);
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr ?? "";
    const message = String(err);
    const isConflict =
      stderr.includes("CONFLICT") ||
      message.includes("CONFLICT") ||
      message.includes("conflict");

    if (isConflict) {
      try {
        await git(["rebase", "--abort"], worktreeDir);
      } catch {
        // Best-effort abort; ignore failure.
      }

      if (dirty) {
        onEvent({
          type: "progress",
          taskId,
          message: "Uncommitted changes are stashed. Run 'git stash pop' to restore them after resolving the conflict.",
        });
      }

      onEvent({
        type: "conflict",
        taskId,
        message: `Rebase conflict for ${taskId}. Resolve the conflicts manually, then run 'ravel integrate ${taskId}'.`,
      });
      return;
    }

    // Non-conflict error.
    throw new Error(`git rebase ${mainBranch} failed`, { cause: err });
  }

  // 4. Run test command (skipped when empty).
  const testCommand = config.testCommand?.trim();
  if (testCommand) {
    onEvent({
      type: "progress",
      taskId,
      message: `Running tests: ${testCommand}`,
    });
    try {
      const [cmd, ...args] = testCommand.split(" ");
      await execFileAsync(cmd, args, { cwd: worktreeDir });
    } catch (err) {
      const stderr = (err as { stderr?: string }).stderr ?? "";
      const stdout = (err as { stdout?: string }).stdout ?? "";
      const output = stdout + stderr;

      if (dirty) {
        onEvent({
          type: "progress",
          taskId,
          message: "Uncommitted changes are stashed. Run 'git stash pop' to restore them after fixing the tests.",
        });
      }

      onEvent({
        type: "test-failure",
        taskId,
        message: `Tests failed for ${taskId}. Fix the test failures, then run 'ravel integrate ${taskId}'.`,
        output,
      });
      return;
    }

    onEvent({
      type: "progress",
      taskId,
      message: "Tests passed",
    });
  }

  // 5. Fast-forward main to the rebased feature branch.
  onEvent({
    type: "progress",
    taskId,
    message: `Merging ${branch} into ${mainBranch}...`,
  });
  try {
    await git(["checkout", mainBranch], projectRoot);
    await git(["merge", "--ff-only", branch], projectRoot);
  } catch (err) {
    throw new Error(`git merge ${branch} into ${mainBranch} failed`, { cause: err });
  }
  onEvent({ type: "progress", taskId, message: "Merged" });

  // 6. Restore stashed changes.
  if (dirty) {
    try {
      await git(["stash", "pop"], projectRoot);
      onEvent({
        type: "progress",
        taskId,
        message: "Restored stashed changes",
      });
    } catch (popErr) {
      onEvent({
        type: "error",
        taskId,
        message: `Failed to restore stashed changes: ${String(popErr)}. Your changes are still in the stash.`,
      });
    }
  }

  // 7. Clean up worktree and branch.
  onEvent({
    type: "progress",
    taskId,
    message: "Cleaning up worktree and branch...",
  });

  try {
    await git(["worktree", "remove", "--force", session.worktreePath], projectRoot);
  } catch (err) {
    throw new Error(`git worktree remove failed`, { cause: err });
  }

  try {
    await git(["branch", "-D", branch], projectRoot);
  } catch {
    // Branch may already be deleted; ignore.
  }

  // 8. Delete session file.
  deleteSession(projectRoot, taskId);

  // 9. Update task status to done on the main repo.
  try {
    updateTaskStatus(taskFilePath, "done");
  } catch {
    // The task file may have already been updated by the rebase; non-fatal.
  }

  onEvent({ type: "complete", taskId });
}
