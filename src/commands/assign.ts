import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { requireInit } from "./config.js";
import { TaskCollection, updateTaskStatus } from "../models/task.js";
import type { Task } from "../models/task.js";
import { readSession, writeSession, deleteSession } from "../models/session.js";
import type { Session } from "../models/session.js";

const execFileAsync = promisify(execFile);

async function git(
  args: string[],
  cwd: string,
): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout;
}

export function deriveBranchName(filename: string): string {
  if (!filename.endsWith(".md")) {
    throw new Error(`Expected .md filename, got: ${filename}`);
  }
  return filename.slice(0, -3);
}

export interface AssignResult {
  session: Session;
  task: Task;
}

async function branchExists(branch: string, cwd: string): Promise<boolean> {
  try {
    const stdout = await git(["branch", "--list", branch], cwd);
    return stdout.trim() !== "";
  } catch {
    return false;
  }
}

async function worktreeExists(worktreePath: string, cwd: string): Promise<boolean> {
  const resolved = path.resolve(fs.realpathSync(cwd), worktreePath);
  try {
    const stdout = await git(["worktree", "list"], cwd);
    return stdout.split("\n").some((line) => {
      const firstToken = line.trim().split(/\s+/)[0];
      return firstToken === resolved;
    });
  } catch {
    return false;
  }
}

export async function assignCommand(
  taskId: string,
  cwd: string = process.cwd(),
): Promise<AssignResult> {
  requireInit(cwd);

  const tasksDir = path.join(cwd, "ravel", "tasks");
  const collection = TaskCollection.load(tasksDir);

  const task = collection.get(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found in ravel/tasks/`);
  }

  if (task.status !== "new") {
    throw new Error(`Task ${taskId} is already ${task.status}`);
  }

  const blocked = task.dependencies.filter((depId) => {
    const dep = collection.get(depId);
    return dep && dep.status !== "done";
  });
  if (blocked.length > 0) {
    const labels = blocked
      .map((id) => {
        const dep = collection.get(id)!;
        return `${dep.id} (${dep.status})`;
      })
      .join(", ");
    throw new Error(`Task ${taskId} is blocked. Depends on: ${labels}`);
  }

  // Check 1: already assigned (session file exists)
  const existingSession = readSession(cwd, taskId);
  if (existingSession) {
    throw new Error(
      `Task ${taskId} is already assigned (session exists at ${existingSession.worktreePath})`,
    );
  }

  const branch = deriveBranchName(task.filename);

  // Check 2: stale worktree
  const wtPath = `.worktrees/${taskId}`;
  if (await worktreeExists(wtPath, cwd)) {
    throw new Error(
      `Stale worktree exists at ${wtPath}. Clean it up with: git worktree remove ${wtPath}`,
    );
  }

  // Check 3: stale branch
  if (await branchExists(branch, cwd)) {
    throw new Error(
      `Stale branch "${branch}" exists. Delete it with: git branch -D ${branch}`,
    );
  }

  // Create branch from HEAD
  await git(["branch", branch, "HEAD"], cwd);

  // Create worktree; clean up branch on failure
  try {
    await git(["worktree", "add", wtPath, branch], cwd);
  } catch (err) {
    // Clean up the branch we just created
    try {
      await git(["branch", "-D", branch], cwd);
    } catch {
      // Branch cleanup failed; ignore.
    }
    throw err;
  }

  // Update task status; clean up branch + worktree on failure
  try {
    updateTaskStatus(task.filePath, "in-progress");
  } catch (err) {
    try {
      await git(["worktree", "remove", "--force", wtPath], cwd);
    } catch {
      // Worktree cleanup failed; ignore.
    }
    try {
      await git(["branch", "-D", branch], cwd);
    } catch {
      // Branch cleanup failed; ignore.
    }
    throw err;
  }

  // Write session; clean up branch + worktree on failure
  const session: Session = {
    taskId,
    branch,
    worktreePath: wtPath,
  };

  try {
    writeSession(cwd, session);
  } catch (err) {
    try {
      await git(["worktree", "remove", "--force", wtPath], cwd);
    } catch {
      // Worktree cleanup failed; ignore.
    }
    try {
      await git(["branch", "-D", branch], cwd);
    } catch {
      // Branch cleanup failed; ignore.
    }
    throw err;
  }

  return { session, task: { ...task, status: "in-progress" } };
}

export async function cleanupWorktree(
  taskId: string,
  cwd: string = process.cwd(),
): Promise<void> {
  const session = readSession(cwd, taskId);
  if (!session) {
    throw new Error(`No session found for task ${taskId}`);
  }

  // Remove worktree (force to skip the prune check)
  const wtPath = session.worktreePath;
  await git(["worktree", "remove", "--force", wtPath], cwd);

  // Delete branch
  try {
    await git(["branch", "-D", session.branch], cwd);
  } catch {
    // Branch may have been already deleted; ignore.
  }

  deleteSession(cwd, taskId);
}
