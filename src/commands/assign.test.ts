import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { deriveBranchName, assignCommand, cleanupWorktree } from "./assign.js";
import { readSession, writeSession } from "../models/session.js";
import { DEFAULT_CONFIG } from "./config.js";

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
      writeTask("T0010", "git-worktree");
      const result = await assignCommand("T0010", tmpDir);

      // Verify session data
      expect(result.session.taskId).toBe("T0010");
      expect(result.session.branch).toBe("T0010-git-worktree");
      expect(result.session.worktreePath).toBe(".worktrees/T0010");

      // Verify task data
      expect(result.task.id).toBe("T0010");
      expect(result.task.status).toBe("in-progress");

      // Verify branch exists
      const branches = await git(
        ["branch", "--list", "T0010-git-worktree"],
        tmpDir,
      );
      expect(branches).toContain("T0010-git-worktree");

      // Verify worktree exists
      const worktrees = await git(["worktree", "list"], tmpDir);
      expect(worktrees).toContain(".worktrees/T0010");

      // Verify session file written
      const sess = readSession(tmpDir, "T0010");
      expect(sess).toEqual(result.session);
    });

    it("updates task status to in-progress", async () => {
      const filePath = writeTask("T0011", "setup");
      await assignCommand("T0011", tmpDir);

      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("status: in-progress");
    });

    it("worktree is created at .worktrees/<taskId>/", async () => {
      writeTask("T0012", "setup");
      const result = await assignCommand("T0012", tmpDir);

      expect(result.session.worktreePath).toBe(".worktrees/T0012");
      expect(fs.existsSync(path.join(tmpDir, ".worktrees", "T0012"))).toBe(
        true,
      );
    });

    it("branch name is derived from task filename", async () => {
      writeTask("T0013", "complex-feature-name");
      const result = await assignCommand("T0013", tmpDir);

      expect(result.session.branch).toBe("T0013-complex-feature-name");
    });
  });

  describe("task not found", () => {
    it("throws when task ID does not exist", async () => {
      await expect(assignCommand("T0999", tmpDir)).rejects.toThrow(
        "not found in ravel/tasks/",
      );
    });
  });

  describe("status validation", () => {
    it("rejects assignment when task is already in-progress", async () => {
      writeTask("T0020", "git-worktree", { status: "in-progress" });
      await expect(assignCommand("T0020", tmpDir)).rejects.toThrow(
        "already in-progress",
      );
    });

    it("rejects assignment when task is already done", async () => {
      writeTask("T0021", "git-worktree", { status: "done" });
      await expect(assignCommand("T0021", tmpDir)).rejects.toThrow(
        "already done",
      );
    });

    it("rejects assignment when task is in review", async () => {
      writeTask("T0022", "git-worktree", { status: "review" });
      await expect(assignCommand("T0022", tmpDir)).rejects.toThrow(
        "already review",
      );
    });
  });

  describe("dependency validation", () => {
    it("rejects assignment when a dependency is not done", async () => {
      writeTask("T0030", "target", {
        dependencies: ["T0031", "T0032"],
      });
      writeTask("T0031", "dep-one", { status: "done" });
      writeTask("T0032", "dep-two", { status: "in-progress" });

      await expect(assignCommand("T0030", tmpDir)).rejects.toThrow(
        "is blocked. Depends on: T0032 (in-progress)",
      );
    });

    it("rejects assignment when multiple dependencies are not done", async () => {
      writeTask("T0033", "target", {
        dependencies: ["T0034", "T0035"],
      });
      writeTask("T0034", "dep-one", { status: "new" });
      writeTask("T0035", "dep-two", { status: "new" });

      await expect(assignCommand("T0033", tmpDir)).rejects.toThrow(
        "is blocked. Depends on: T0034 (new), T0035 (new)",
      );
    });

    it("allows assignment when all dependencies are done", async () => {
      writeTask("T0036", "target", {
        dependencies: ["T0037", "T0038"],
      });
      writeTask("T0037", "dep-one", { status: "done" });
      writeTask("T0038", "dep-two", { status: "done" });

      const result = await assignCommand("T0036", tmpDir);
      expect(result.session.taskId).toBe("T0036");
    });

    it("allows assignment when there are no dependencies", async () => {
      writeTask("T0039", "target", { dependencies: [] });
      const result = await assignCommand("T0039", tmpDir);
      expect(result.session.taskId).toBe("T0039");
    });
  });

  describe("duplicate prevention - session file", () => {
    it("throws when session file already exists", async () => {
      writeTask("T0040", "git-worktree");

      // Simulate a pre-existing session
      writeSession(tmpDir, {
        taskId: "T0040",
        branch: "T0040-git-worktree",
        worktreePath: ".worktrees/T0040",
      });

      await expect(assignCommand("T0040", tmpDir)).rejects.toThrow(
        "already assigned",
      );
    });
  });

  describe("duplicate prevention - stale worktree", () => {
    it("throws when worktree path already exists in git worktree list", async () => {
      writeTask("T0050", "git-worktree");

      // Create a stale worktree manually
      await git(["branch", "old-branch", "HEAD"], tmpDir);
      await git(["worktree", "add", ".worktrees/T0050", "old-branch"], tmpDir);

      await expect(assignCommand("T0050", tmpDir)).rejects.toThrow(
        "Stale worktree exists",
      );
    });
  });

  describe("duplicate prevention - stale branch", () => {
    it("throws when branch already exists (without worktree)", async () => {
      writeTask("T0060", "git-worktree");

      // Create just the branch, no worktree
      await git(["branch", "T0060-git-worktree", "HEAD"], tmpDir);

      await expect(assignCommand("T0060", tmpDir)).rejects.toThrow(
        'Stale branch "T0060-git-worktree" exists',
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
    writeTask("T0070", "git-worktree");
    await assignCommand("T0070", tmpDir);

    await cleanupWorktree("T0070", tmpDir);

    // Verify worktree is gone
    const worktrees = await git(["worktree", "list"], tmpDir);
    expect(worktrees).not.toContain(".worktrees/T0070");

    // Verify branch is gone
    const branches = await git(
      ["branch", "--list", "T0070-git-worktree"],
      tmpDir,
    );
    expect(branches.trim()).toBe("");

    // Verify session file is gone
    expect(readSession(tmpDir, "T0070")).toBeNull();
  });

  it("throws when no session exists for the task", async () => {
    await expect(cleanupWorktree("T0999", tmpDir)).rejects.toThrow(
      "No session found",
    );
  });

  it("removes worktree directory from disk", async () => {
    writeTask("T0071", "git-worktree");
    await assignCommand("T0071", tmpDir);

    const wtPath = path.join(tmpDir, ".worktrees", "T0071");
    expect(fs.existsSync(wtPath)).toBe(true);

    await cleanupWorktree("T0071", tmpDir);

    expect(fs.existsSync(wtPath)).toBe(false);
  });
});
