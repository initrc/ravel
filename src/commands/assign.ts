import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { requireInit } from "../config.js";
import { TaskCollection } from "../task.js";
import { readSession, writeSession, deleteSession } from "../session.js";
import type { Session } from "../session.js";

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
): Promise<Session> {
  requireInit(cwd);

  const tasksDir = path.join(cwd, "ravel", "tasks");
  const collection = TaskCollection.load(tasksDir);

  const task = collection.get(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found in ravel/tasks/`);
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

  // Create worktree
  await git(["worktree", "add", wtPath, branch], cwd);

  const session: Session = {
    taskId,
    branch,
    worktreePath: wtPath,
  };

  writeSession(cwd, session);
  return session;
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
