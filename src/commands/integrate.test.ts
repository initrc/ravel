import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IntegrationEvent } from "./integrate.js";

const DEFAULT_CONFIG = {
  agentCommand: "claude",
  copyCommandByDefault: false,
  mainBranch: "main",
  testCommand: "npm test",
  notifyWhenDone: true,
};

// ---------------------------------------------------------------------------
// Hoisted mocks (accessible inside vi.mock factories and tests)
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  const mockExecFile = vi.fn(
    (
      _cmd: string,
      _args: string[],
      _opts:
        | Record<string, unknown>
        | ((err: Error | null, result: { stdout: string; stderr: string }) => void),
      cb?: (err: Error | null, result: { stdout: string; stderr: string }) => void,
    ) => {
      const callback = (typeof _opts === "function" ? _opts : cb)!;
      callback(null, { stdout: "", stderr: "" });
      return {};
    },
  );

  return {
    mockGit: vi.fn(),
    mockReadConfig: vi.fn(),
    mockReadSession: vi.fn(),
    mockDeleteSession: vi.fn(),
    mockUpdateTaskStatus: vi.fn(),
    mockExecFile,
  };
});

vi.mock("node:child_process", () => ({
  execFile: mocks.mockExecFile,
}));

vi.mock("./git.js", () => ({ git: mocks.mockGit }));

vi.mock("./config.js", () => ({ readConfig: mocks.mockReadConfig }));

vi.mock("../models/session.js", () => ({
  readSession: mocks.mockReadSession,
  deleteSession: mocks.mockDeleteSession,
}));

vi.mock("../models/task.js", () => ({
  updateTaskStatus: mocks.mockUpdateTaskStatus,
}));

const { runIntegration } = await import("./integrate.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const projectRoot = "/tmp/test-project";
const branch = "T0042-fix-bug";
const taskId = "T0042";

function session() {
  return { taskId, branch, worktreePath: ".worktrees/T0042" };
}

function setupConfig(overrides: Partial<typeof DEFAULT_CONFIG> = {}) {
  mocks.mockReadConfig.mockReturnValue({ ...DEFAULT_CONFIG, ...overrides });
}

function setupSession(sess = session()) {
  mocks.mockReadSession.mockReturnValue(sess);
}

function gitSuccess(args: string[]): string {
  if (args[0] === "stash" && args[1] === "push") return "Saved working directory";
  if (args[0] === "stash" && args[1] === "pop") return "Dropped refs/stash@{0}";
  if (args[0] === "checkout") return "";
  if (args[0] === "merge") return "Fast-forward";
  if (args[0] === "merge-base") return "abc1234\n";
  if (args[0] === "rev-parse") return "abc1234\n";
  if (args[0] === "worktree" && args[1] === "remove") return "";
  if (args[0] === "branch" && args[1] === "-D") return "";
  return "";
}

function setupCleanBoth() {
  mocks.mockGit.mockImplementation((args: string[], _cwd: string) => {
    if (args[0] === "status" && args[1] === "--porcelain") return "";
    return gitSuccess(args);
  });
}

function collectEvents(): {
  events: IntegrationEvent[];
  callback: (e: IntegrationEvent) => void;
} {
  const events: IntegrationEvent[] = [];
  return { events, callback: (e: IntegrationEvent) => { events.push(e); } };
}

function execFileSuccess() {
  mocks.mockExecFile.mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts:
        | Record<string, unknown>
        | ((err: Error | null, result: { stdout: string; stderr: string }) => void),
      cb?: (err: Error | null, result: { stdout: string; stderr: string }) => void,
    ) => {
      const callback = (typeof _opts === "function" ? _opts : cb)!;
      callback(null, { stdout: "", stderr: "" });
      return {};
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  execFileSuccess();
  setupConfig();
  setupSession();
  setupCleanBoth();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("runIntegration", () => {
  describe("missing session", () => {
    it("throws when no session exists for the task", async () => {
      mocks.mockReadSession.mockReturnValue(null);

      await expect(
        runIntegration(taskId, projectRoot, () => {}),
      ).rejects.toThrow("No session found for task T0042");
    });
  });

  describe("happy path — clean main, no test command", () => {
    it("verifies rebase, merges, cleans up, and emits complete event", async () => {
      setupConfig({ testCommand: "" });

      const { events, callback } = collectEvents();
      await runIntegration(taskId, projectRoot, callback);

      expect(mocks.mockGit).toHaveBeenCalledWith(["status", "--porcelain"], projectRoot);
      expect(mocks.mockGit).toHaveBeenCalledWith(
        ["merge-base", branch, "main"],
        projectRoot,
      );
      expect(mocks.mockGit).toHaveBeenCalledWith(["rev-parse", "main"], projectRoot);
      expect(mocks.mockGit).toHaveBeenCalledWith(["checkout", "main"], projectRoot);
      expect(mocks.mockGit).toHaveBeenCalledWith(
        ["merge", "--ff-only", branch],
        projectRoot,
      );
      expect(mocks.mockGit).toHaveBeenCalledWith(
        ["worktree", "remove", "--force", ".worktrees/T0042"],
        projectRoot,
      );
      expect(mocks.mockGit).toHaveBeenCalledWith(["branch", "-D", branch], projectRoot);

      expect(mocks.mockDeleteSession).toHaveBeenCalledWith(projectRoot, taskId);
      expect(mocks.mockUpdateTaskStatus).toHaveBeenCalled();

      const eventTypes = events.map((e) => e.type);
      expect(eventTypes).toContain("progress");
      expect(eventTypes).toContain("complete");
      expect(events[events.length - 1].type).toBe("complete");
    });
  });

  describe("happy path — dirty main with test command", () => {
    it("stashes, verifies rebase, runs tests, unstashes, merge, cleanup", async () => {
      setupConfig({ testCommand: "true" });

      mocks.mockGit.mockImplementation((args: string[], cwd: string) => {
        if (args[0] === "status" && args[1] === "--porcelain") {
          return cwd === projectRoot ? " M dirty.txt" : "";
        }
        return gitSuccess(args);
      });

      const { events, callback } = collectEvents();
      await runIntegration(taskId, projectRoot, callback);

      expect(mocks.mockGit).toHaveBeenCalledWith(
        ["stash", "push", "--include-untracked"],
        projectRoot,
      );
      expect(mocks.mockGit).toHaveBeenCalledWith(["stash", "pop"], projectRoot);

      const progressMessages = events
        .filter((e) => e.type === "progress")
        .map((e) => (e as { message: string }).message);
      expect(progressMessages.some((m) => m.includes("true"))).toBe(true);
      expect(progressMessages.some((m) => m === "Tests passed")).toBe(true);
    });
  });

  describe("test command failure", () => {
    it("emits test-failure event and returns without merging", async () => {
      setupConfig({ testCommand: "false" });

      mocks.mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          _opts:
            | Record<string, unknown>
            | ((
                err: Error | null,
                result: { stdout: string; stderr: string },
              ) => void),
          cb?: (err: Error | null, result: { stdout: string; stderr: string }) => void,
        ) => {
          const callback = (typeof _opts === "function" ? _opts : cb)!;
          callback(new Error("Command failed"), {
            stdout: "test output",
            stderr: "assertion error",
          });
          return {};
        },
      );

      const { events, callback } = collectEvents();
      await runIntegration(taskId, projectRoot, callback);

      const testFailure = events.find((e) => e.type === "test-failure");
      expect(testFailure).toBeDefined();
      expect((testFailure as { taskId: string }).taskId).toBe(taskId);

      expect(mocks.mockGit).not.toHaveBeenCalledWith(["checkout", "main"], projectRoot);
    });

    it("reminds about stashed changes when main was dirty", async () => {
      setupConfig({ testCommand: "false" });

      mocks.mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          _opts:
            | Record<string, unknown>
            | ((
                err: Error | null,
                result: { stdout: string; stderr: string },
              ) => void),
          cb?: (err: Error | null, result: { stdout: string; stderr: string }) => void,
        ) => {
          const callback = (typeof _opts === "function" ? _opts : cb)!;
          callback(new Error("Command failed"), { stdout: "", stderr: "" });
          return {};
        },
      );

      mocks.mockGit.mockImplementation((args: string[], cwd: string) => {
        if (args[0] === "status" && args[1] === "--porcelain") {
          return cwd === projectRoot ? " M f" : "";
        }
        if (args[0] === "stash" && args[1] === "push") return "";
        return gitSuccess(args);
      });

      const { events, callback } = collectEvents();
      await runIntegration(taskId, projectRoot, callback);

      const progressMessages = events
        .filter((e) => e.type === "progress")
        .map((e) => (e as { message: string }).message);
      expect(progressMessages.some((m) => m.includes("stash pop"))).toBe(true);
    });
  });

  describe("merge failure", () => {
    it("throws when fast-forward merge fails", async () => {
      setupConfig({ testCommand: "" });

      mocks.mockGit.mockImplementation((args: string[], _cwd: string) => {
        if (args[0] === "status" && args[1] === "--porcelain") return "";
        if (args[0] === "merge-base") return "abc1234\n";
        if (args[0] === "rev-parse") return "abc1234\n";
        if (args[0] === "checkout") return "";
        if (args[0] === "merge") throw new Error("fatal: Not possible to fast-forward");
        return gitSuccess(args);
      });

      await expect(
        runIntegration(taskId, projectRoot, () => {}),
      ).rejects.toThrow("git merge T0042-fix-bug into main failed");
    });
  });

  describe("stash pop failure", () => {
    it("emits error event but continues to cleanup", async () => {
      setupConfig({ testCommand: "" });

      mocks.mockGit.mockImplementation((args: string[], cwd: string) => {
        if (args[0] === "status" && args[1] === "--porcelain") {
          return cwd === projectRoot ? " M f" : "";
        }
        if (args[0] === "stash" && args[1] === "push") return "";
        if (args[0] === "stash" && args[1] === "pop") {
          throw new Error("Merge conflict in stash pop");
        }
        return gitSuccess(args);
      });

      const { events, callback } = collectEvents();
      await runIntegration(taskId, projectRoot, callback);

      const errorEvent = events.find((e) => e.type === "error");
      expect(errorEvent).toBeDefined();
      expect((errorEvent as { message: string }).message).toContain(
        "Failed to restore stashed changes",
      );

      expect(mocks.mockGit).toHaveBeenCalledWith(
        ["worktree", "remove", "--force", ".worktrees/T0042"],
        projectRoot,
      );
      expect(events.some((e) => e.type === "complete")).toBe(true);
    });
  });

  describe("worktree remove failure", () => {
    it("throws when git worktree remove fails", async () => {
      setupConfig({ testCommand: "" });

      mocks.mockGit.mockImplementation((args: string[], _cwd: string) => {
        if (args[0] === "status" && args[1] === "--porcelain") return "";
        if (args[0] === "worktree" && args[1] === "remove") {
          throw new Error("worktree is not managed by this repo");
        }
        return gitSuccess(args);
      });

      await expect(
        runIntegration(taskId, projectRoot, () => {}),
      ).rejects.toThrow("git worktree remove failed");
    });
  });

  describe("branch delete failure", () => {
    it("continues despite branch delete failure", async () => {
      setupConfig({ testCommand: "" });

      mocks.mockGit.mockImplementation((args: string[], _cwd: string) => {
        if (args[0] === "status" && args[1] === "--porcelain") return "";
        if (args[0] === "branch" && args[1] === "-D") {
          throw new Error("branch not found");
        }
        return gitSuccess(args);
      });

      const { events, callback } = collectEvents();
      await runIntegration(taskId, projectRoot, callback);

      expect(events.some((e) => e.type === "complete")).toBe(true);
      expect(mocks.mockDeleteSession).toHaveBeenCalled();
    });
  });

  describe("update task status failure", () => {
    it("continues despite updateTaskStatus failure", async () => {
      setupConfig({ testCommand: "" });
      mocks.mockUpdateTaskStatus.mockImplementation(() => {
        throw new Error("file not found");
      });

      const { events, callback } = collectEvents();
      await runIntegration(taskId, projectRoot, callback);

      expect(events.some((e) => e.type === "complete")).toBe(true);
    });
  });

  describe("polling for commit and rebase", () => {
    it("waits for worktree to become clean and rebased", async () => {
      setupConfig({ testCommand: "" });

      vi.useFakeTimers();
      try {
        let pollCount = 0;
        mocks.mockGit.mockImplementation((args: string[], cwd: string) => {
          if (args[0] === "status" && args[1] === "--porcelain") {
            if (cwd === projectRoot) return "";
            pollCount++;
            return pollCount <= 2 ? " M file.txt" : "";
          }
          return gitSuccess(args);
        });

        const { events, callback } = collectEvents();
        const promise = runIntegration(taskId, projectRoot, callback);

        // Advance past the 500ms polling intervals to unblock the loop
        for (let i = 0; i < 5; i++) {
          await vi.advanceTimersByTimeAsync(500);
        }

        const result = await promise;
        expect(result).toBeUndefined();

        expect(pollCount).toBeGreaterThanOrEqual(2);
        const progressMessages = events
          .filter((e) => e.type === "progress")
          .map((e) => (e as { message: string }).message);
        expect(progressMessages.some((m) => m.includes("Waiting for commit"))).toBe(
          true,
        );
        expect(events.some((e) => e.type === "complete")).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it("throws after timeout when conditions are never met", async () => {
      setupConfig({ testCommand: "" });

      vi.useFakeTimers();
      try {
        mocks.mockGit.mockImplementation((args: string[], cwd: string) => {
          if (args[0] === "status" && args[1] === "--porcelain") {
            if (cwd === projectRoot) return "";
            return " M file.txt"; // worktree never becomes clean
          }
          return gitSuccess(args);
        });

        const { callback } = collectEvents();
        const promise = runIntegration(taskId, projectRoot, callback);
        promise.catch(() => {}); // suppress unhandled rejection during fake timer advance

        await vi.advanceTimersByTimeAsync(300_001);

        await expect(promise).rejects.toThrow(
          "Timed out waiting for agent to complete.",
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
