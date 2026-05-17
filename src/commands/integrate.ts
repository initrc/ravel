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

async function hasRemote(cwd: string): Promise<boolean> {
  try {
    await git(["remote", "get-url", "origin"], cwd);
    return true;
  } catch {
    return false;
  }
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
  const originExists = await hasRemote(worktreeDir);

  // 1. Fetch the latest main branch.
  //    Uses the remote-tracking ref when a remote exists; otherwise rebases
  //    directly onto the local main branch.
  const rebaseTarget = originExists ? `origin/${mainBranch}` : mainBranch;

  if (originExists) {
    onEvent({
      type: "progress",
      taskId,
      message: `Fetching ${rebaseTarget}...`,
    });
    try {
      await git(["fetch", "origin", mainBranch], worktreeDir);
    } catch (err) {
      throw new Error(`git fetch origin ${mainBranch} failed: ${(err as Error).message}`);
    }
  }

  // 2. Rebase onto the target.
  onEvent({
    type: "progress",
    taskId,
    message: `Rebasing onto ${rebaseTarget}...`,
  });
  try {
    await git(["rebase", rebaseTarget], worktreeDir);
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr ?? "";
    const message = (err as Error).message;
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

      onEvent({
        type: "conflict",
        taskId,
        message: `Rebase conflict for ${taskId}. Resolve the conflicts manually, then run 'ravel integrate ${taskId}'.`,
      });
      return;
    }

    throw new Error(`git rebase ${rebaseTarget} failed: ${message}`);
  }

  // 3. Run test command (skipped when empty).
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

  // 4. Push the rebased branch.
  if (originExists && config.pushOnIntegration) {
    onEvent({
      type: "progress",
      taskId,
      message: `Pushing ${branch} to origin...`,
    });
    try {
      await git(["push", "origin", branch], worktreeDir);
    } catch (err) {
      throw new Error(`git push origin ${branch} failed: ${(err as Error).message}`);
    }
    onEvent({ type: "progress", taskId, message: "Pushed" });
  }

  // 5. Clean up worktree and branch.
  onEvent({
    type: "progress",
    taskId,
    message: "Cleaning up worktree and branch...",
  });

  try {
    await git(["worktree", "remove", "--force", session.worktreePath], projectRoot);
  } catch (err) {
    throw new Error(`git worktree remove failed: ${(err as Error).message}`);
  }

  try {
    await git(["branch", "-D", branch], projectRoot);
  } catch {
    // Branch may already be deleted; ignore.
  }

  // 6. Delete session file.
  deleteSession(projectRoot, taskId);

  // 7. Update task status to done on the main repo.
  try {
    updateTaskStatus(taskFilePath, "done");
  } catch {
    // The task file may have already been updated by the rebase; non-fatal.
  }

  // 8. Sync local main branch with remote so the user's working directory
  //    doesn't fall behind the just-pushed integration.
  if (originExists) {
    onEvent({
      type: "progress",
      taskId,
      message: `Pulling latest ${mainBranch}...`,
    });
    try {
      await git(["pull", "--ff-only", "origin", mainBranch], projectRoot);
      onEvent({
        type: "progress",
        taskId,
        message: `Local ${mainBranch} is up to date`,
      });
    } catch {
      // Non-fatal: user may be on a different branch, have local commits,
      // or the remote might not have the changes merged yet.
    }
  }

  onEvent({ type: "complete", taskId });
}
