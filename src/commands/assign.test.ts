import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { deriveBranchName, assignCommand, cleanupWorktree } from "./assign";
import { readSession, writeSession } from "../session";
import { DEFAULT_CONFIG } from "../config";

const execFileAsync = promisify(execFile);

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout;
}

// ---------------------------------------------------------------------------
// deriveBranchName
// ---------------------------------------------------------------------------
describe("deriveBranchName", () => {
  it("strips .md extension from filename", () => {
    expect(deriveBranchName("T0003-git-worktree.md")).toBe(
      "T0003-git-worktree",
    );
  });

  it("handles filenames with multiple dashes", () => {
    expect(deriveBranchName("T0001-fix-user-auth-flow.md")).toBe(
      "T0001-fix-user-auth-flow",
    );
  });

  it("handles simple filenames", () => {
    expect(deriveBranchName("T0042-setup.md")).toBe("T0042-setup");
  });

  it("throws on non-.md filenames", () => {
    expect(() => deriveBranchName("T0003-task.txt")).toThrow(
      "Expected .md filename",
    );
  });
});

// ---------------------------------------------------------------------------
// assignCommand
// ---------------------------------------------------------------------------
describe("assignCommand", () => {
  let tmpDir: string;
  let tasksDir: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join("/tmp", "ravel-assign-test-"));

    // Init a git repo
    await git(["init"], tmpDir);
    await git(
      [
        "-c",
        "user.name=test",
        "-c",
        "user.email=test@test.com",
        "commit",
        "--allow-empty",
        "-m",
        "initial",
      ],
      tmpDir,
    );

    // Create Ravel project structure
    fs.mkdirSync(path.join(tmpDir, ".ravel", "sessions"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, ".ravel", "logs"), { recursive: true });
    tasksDir = path.join(tmpDir, "ravel", "tasks");
    fs.mkdirSync(tasksDir, { recursive: true });

    // Write config
    fs.writeFileSync(
      path.join(tmpDir, ".ravel", "config.json"),
      JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n",
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeTask(
    id: string,
    slug: string,
    overrides: Partial<{
      title: string;
      status: string;
      dependencies: string[];
    }> = {},
  ): string {
    const filename = `${id}-${slug}.md`;
    const fm: Record<string, unknown> = {
      id,
      title: overrides.title ?? `Task ${id}`,
      status: overrides.status ?? "new",
      dependencies: overrides.dependencies ?? [],
    };
    const yaml = Object.entries(fm)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join("\n");
    const filePath = path.join(tasksDir, filename);
    fs.writeFileSync(filePath, `---\n${yaml}\n---\nBody for ${id}`);
    return filePath;
  }

  describe("successful assignment", () => {
    it("creates branch, worktree, and session file", async () => {
      writeTask("T0003", "git-worktree");
      const session = await assignCommand("T0003", tmpDir);

      // Verify session data
      expect(session.taskId).toBe("T0003");
      expect(session.branch).toBe("T0003-git-worktree");
      expect(session.worktreePath).toBe(".worktrees/T0003");

      // Verify branch exists
      const branches = await git(
        ["branch", "--list", "T0003-git-worktree"],
        tmpDir,
      );
      expect(branches).toContain("T0003-git-worktree");

      // Verify worktree exists
      const worktrees = await git(["worktree", "list"], tmpDir);
      expect(worktrees).toContain(".worktrees/T0003");

      // Verify session file written
      const sess = readSession(tmpDir, "T0003");
      expect(sess).toEqual(session);
    });

    it("worktree is created at .worktrees/<taskId>/", async () => {
      writeTask("T0001", "setup");
      const session = await assignCommand("T0001", tmpDir);

      expect(session.worktreePath).toBe(".worktrees/T0001");
      expect(fs.existsSync(path.join(tmpDir, ".worktrees", "T0001"))).toBe(
        true,
      );
    });

    it("branch name is derived from task filename", async () => {
      writeTask("T0042", "complex-feature-name");
      const session = await assignCommand("T0042", tmpDir);

      expect(session.branch).toBe("T0042-complex-feature-name");
    });
  });

  describe("task not found", () => {
    it("throws when task ID does not exist", async () => {
      await expect(assignCommand("T0999", tmpDir)).rejects.toThrow(
        "not found in ravel/tasks/",
      );
    });
  });

  describe("duplicate prevention - session file", () => {
    it("throws when session file already exists", async () => {
      writeTask("T0003", "git-worktree");

      // Simulate a pre-existing session
      writeSession(tmpDir, {
        taskId: "T0003",
        branch: "T0003-git-worktree",
        worktreePath: ".worktrees/T0003",
      });

      await expect(assignCommand("T0003", tmpDir)).rejects.toThrow(
        "already assigned",
      );
    });
  });

  describe("duplicate prevention - stale worktree", () => {
    it("throws when worktree path already exists in git worktree list", async () => {
      writeTask("T0003", "git-worktree");

      // Create a stale worktree manually
      await git(["branch", "old-branch", "HEAD"], tmpDir);
      await git(["worktree", "add", ".worktrees/T0003", "old-branch"], tmpDir);
      // Delete any session file so only the worktree is stale
      // (session file cleanup not needed here since we didn't write one)

      await expect(assignCommand("T0003", tmpDir)).rejects.toThrow(
        "Stale worktree exists",
      );
    });
  });

  describe("duplicate prevention - stale branch", () => {
    it("throws when branch already exists (without worktree)", async () => {
      writeTask("T0003", "git-worktree");

      // Create just the branch, no worktree
      await git(["branch", "T0003-git-worktree", "HEAD"], tmpDir);

      await expect(assignCommand("T0003", tmpDir)).rejects.toThrow(
        'Stale branch "T0003-git-worktree" exists',
      );
    });
  });
});

// ---------------------------------------------------------------------------
// cleanupWorktree
// ---------------------------------------------------------------------------
describe("cleanupWorktree", () => {
  let tmpDir: string;
  let tasksDir: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join("/tmp", "ravel-cleanup-test-"));

    await git(["init"], tmpDir);
    await git(
      [
        "-c",
        "user.name=test",
        "-c",
        "user.email=test@test.com",
        "commit",
        "--allow-empty",
        "-m",
        "initial",
      ],
      tmpDir,
    );

    fs.mkdirSync(path.join(tmpDir, ".ravel", "sessions"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, ".ravel", "logs"), { recursive: true });
    tasksDir = path.join(tmpDir, "ravel", "tasks");
    fs.mkdirSync(tasksDir, { recursive: true });

    fs.writeFileSync(
      path.join(tmpDir, ".ravel", "config.json"),
      JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n",
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeTask(id: string, slug: string): void {
    const fm: Record<string, unknown> = {
      id,
      title: `Task ${id}`,
      status: "new",
      dependencies: [],
    };
    const yaml = Object.entries(fm)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join("\n");
    fs.writeFileSync(
      path.join(tasksDir, `${id}-${slug}.md`),
      `---\n${yaml}\n---\nBody`,
    );
  }

  it("removes worktree, branch, and session file", async () => {
    writeTask("T0003", "git-worktree");
    await assignCommand("T0003", tmpDir);

    await cleanupWorktree("T0003", tmpDir);

    // Verify worktree is gone
    const worktrees = await git(["worktree", "list"], tmpDir);
    expect(worktrees).not.toContain(".worktrees/T0003");

    // Verify branch is gone
    const branches = await git(
      ["branch", "--list", "T0003-git-worktree"],
      tmpDir,
    );
    expect(branches.trim()).toBe("");

    // Verify session file is gone
    expect(readSession(tmpDir, "T0003")).toBeNull();
  });

  it("throws when no session exists for the task", async () => {
    await expect(cleanupWorktree("T0999", tmpDir)).rejects.toThrow(
      "No session found",
    );
  });

  it("removes worktree directory from disk", async () => {
    writeTask("T0003", "git-worktree");
    await assignCommand("T0003", tmpDir);

    const wtPath = path.join(tmpDir, ".worktrees", "T0003");
    expect(fs.existsSync(wtPath)).toBe(true);

    await cleanupWorktree("T0003", tmpDir);

    expect(fs.existsSync(wtPath)).toBe(false);
  });
});
