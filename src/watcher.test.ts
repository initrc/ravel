import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { RavelWatcher } from "./watcher.js";
import type { RavelEvent } from "./events.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function taskFile(name: string, id: string, status: string): string {
  return `---\nid: ${id}\ntitle: Test ${id}\nstatus: ${status}\ndependencies: []\n---\n\n# Scope\n\nTest task.\n`;
}

function sessionFile(taskId: string, worktreePath: string): string {
  return (
    JSON.stringify(
      {
        taskId,
        branch: `${taskId}-test`,
        worktreePath,
      },
      null,
      2,
    ) + "\n"
  );
}

describe("RavelWatcher", () => {
  let root: string;
  let watcher: RavelWatcher;
  let events: RavelEvent[];

  function collectEvents(): void {
    watcher.on("event", (e: RavelEvent) => events.push(e));
  }

  async function waitForEvents({
    count = 1,
    timeoutMs = 2000,
  }: { count?: number; timeoutMs?: number } = {}): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (events.length < count && Date.now() < deadline) {
      await sleep(50);
    }
  }

  beforeEach(async () => {
    // Allow OS to release native watcher resources from the previous test
    await sleep(200);
    root = fs.mkdtempSync(path.join(os.tmpdir(), "ravel-watcher-test-"));
    fs.mkdirSync(path.join(root, "ravel", "tasks"), { recursive: true });
    fs.mkdirSync(path.join(root, "ravel", "docs"), { recursive: true });
    fs.mkdirSync(path.join(root, ".ravel", "sessions"), { recursive: true });
    watcher = new RavelWatcher(root);
    events = [];
  });

  afterEach(async () => {
    await watcher.stop();
    fs.rmSync(root, { recursive: true, force: true });
  });

  describe("task creation", () => {
    it("emits task-created when a new task file appears", async () => {
      await watcher.start();
      collectEvents();

      const filePath = path.join(root, "ravel", "tasks", "T0010-test.md");
      fs.writeFileSync(filePath, taskFile("T0010-test.md", "T0010", "new"));

      await waitForEvents({ count: 1 });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "task-created",
        taskId: "T0010",
        filename: "T0010-test.md",
      });
    });

    it("ignores files with invalid frontmatter", async () => {
      await watcher.start();
      collectEvents();

      const filePath = path.join(root, "ravel", "tasks", "T0010-bad.md");
      fs.writeFileSync(filePath, "not a task file");

      await sleep(300);
      // Give time for any possible events to flush — none should arrive
      expect(events.filter((e) => e.type === "task-created")).toHaveLength(0);
    });
  });

  describe("task status changes", () => {
    it("emits task-status-changed when a task's status changes", async () => {
      const filePath = path.join(root, "ravel", "tasks", "T0010-test.md");
      fs.writeFileSync(filePath, taskFile("T0010-test.md", "T0010", "new"));

      await watcher.start();
      collectEvents();

      // Modify the status
      fs.writeFileSync(
        filePath,
        taskFile("T0010-test.md", "T0010", "in-progress"),
      );

      await waitForEvents({ count: 1 });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "task-status-changed",
        taskId: "T0010",
        oldStatus: "new",
        newStatus: "in-progress",
      });
    });

    it("does not emit when status is unchanged", async () => {
      const filePath = path.join(root, "ravel", "tasks", "T0010-test.md");
      fs.writeFileSync(filePath, taskFile("T0010-test.md", "T0010", "new"));

      await watcher.start();
      collectEvents();

      // Rewrite with same status
      fs.writeFileSync(filePath, taskFile("T0010-test.md", "T0010", "new"));

      await sleep(300);
      expect(
        events.filter((e) => e.type === "task-status-changed"),
      ).toHaveLength(0);
    });
  });

  describe("doc creation", () => {
    it("emits doc-created when a new doc file appears", async () => {
      await watcher.start();
      collectEvents();

      const filePath = path.join(root, "ravel", "docs", "design.md");
      fs.writeFileSync(filePath, "# Design Doc\n");

      await waitForEvents({ count: 1 });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "doc-created",
        filename: "design.md",
      });
    });
  });

  describe("session registration", () => {
    it("emits session-registered when a new session file appears", async () => {
      await watcher.start();
      collectEvents();

      fs.mkdirSync(path.join(root, ".worktrees", "T0003", "ravel", "tasks"), {
        recursive: true,
      });
      const sessPath = path.join(root, ".ravel", "sessions", "T0003.json");
      fs.writeFileSync(sessPath, sessionFile("T0003", ".worktrees/T0003"));

      await waitForEvents({ count: 1 });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "session-registered",
        taskId: "T0003",
      });
    });
  });

  describe("dynamic worktree watching", () => {
    it("emits task-status-changed when a worktree task changes", async () => {
      const worktreeTasksDir = path.join(
        root,
        ".worktrees",
        "T0003",
        "ravel",
        "tasks",
      );
      fs.mkdirSync(worktreeTasksDir, { recursive: true });
      const wtTaskPath = path.join(worktreeTasksDir, "T0003-test.md");
      fs.writeFileSync(wtTaskPath, taskFile("T0003-test.md", "T0003", "new"));

      // Write session file pointing to the worktree
      fs.writeFileSync(
        path.join(root, ".ravel", "sessions", "T0003.json"),
        sessionFile("T0003", ".worktrees/T0003"),
      );

      await watcher.start();
      collectEvents();

      // Modify the task in the worktree
      fs.writeFileSync(
        wtTaskPath,
        taskFile("T0003-test.md", "T0003", "in-progress"),
      );

      await waitForEvents({ count: 1 });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "task-status-changed",
        taskId: "T0003",
        oldStatus: "new",
        newStatus: "in-progress",
      });
    });

    it("starts watching a worktree when a new session is created after start", async () => {
      const worktreeTasksDir = path.join(
        root,
        ".worktrees",
        "T0004",
        "ravel",
        "tasks",
      );
      fs.mkdirSync(worktreeTasksDir, { recursive: true });
      const wtTaskPath = path.join(worktreeTasksDir, "T0004-test.md");
      fs.writeFileSync(wtTaskPath, taskFile("T0004-test.md", "T0004", "new"));

      await watcher.start();
      collectEvents();

      // Create session file after watcher has started
      fs.writeFileSync(
        path.join(root, ".ravel", "sessions", "T0004.json"),
        sessionFile("T0004", ".worktrees/T0004"),
      );

      // Wait for session-registered event
      await waitForEvents({ count: 1 });
      expect(events[0]).toMatchObject({
        type: "session-registered",
        taskId: "T0004",
      });

      // Now modify the worktree task
      fs.writeFileSync(
        wtTaskPath,
        taskFile("T0004-test.md", "T0004", "review"),
      );

      await waitForEvents({ count: 2 });
      const statusEvents = events.filter(
        (e) => e.type === "task-status-changed",
      );
      expect(statusEvents).toHaveLength(1);
      expect(statusEvents[0]).toMatchObject({
        type: "task-status-changed",
        taskId: "T0004",
        oldStatus: "new",
        newStatus: "review",
      });
    });

    it("stops watching worktree when session file is removed", async () => {
      const worktreeTasksDir = path.join(
        root,
        ".worktrees",
        "T0005",
        "ravel",
        "tasks",
      );
      fs.mkdirSync(worktreeTasksDir, { recursive: true });
      const wtTaskPath = path.join(worktreeTasksDir, "T0005-test.md");
      fs.writeFileSync(wtTaskPath, taskFile("T0005-test.md", "T0005", "new"));

      const sessPath = path.join(root, ".ravel", "sessions", "T0005.json");
      fs.writeFileSync(sessPath, sessionFile("T0005", ".worktrees/T0005"));

      await watcher.start();
      collectEvents();

      // Remove the session file
      fs.unlinkSync(sessPath);

      await sleep(200);

      // Modify the worktree task — should not emit because watcher is stopped
      fs.writeFileSync(wtTaskPath, taskFile("T0005-test.md", "T0005", "done"));

      await sleep(300);
      expect(
        events.filter((e) => e.type === "task-status-changed"),
      ).toHaveLength(0);
    });
  });

  describe("debounce", () => {
    it("debounces rapid changes into a single event", async () => {
      // Pre-create the file so it's cached during start()
      const filePath = path.join(root, "ravel", "tasks", "T0010-test.md");
      fs.writeFileSync(filePath, taskFile("T0010-test.md", "T0010", "new"));

      await watcher.start();
      collectEvents();

      // Rapidly rewrite the same file multiple times — all within 100ms
      fs.writeFileSync(
        filePath,
        taskFile("T0010-test.md", "T0010", "in-progress"),
      );
      fs.writeFileSync(filePath, taskFile("T0010-test.md", "T0010", "review"));
      fs.writeFileSync(filePath, taskFile("T0010-test.md", "T0010", "done"));

      await waitForEvents({ count: 1, timeoutMs: 2000 });
      // Only one event because rapid changes are debounced
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "task-status-changed",
        taskId: "T0010",
        oldStatus: "new",
        newStatus: "done",
      });
    });
  });

  describe("lifecycle", () => {
    it("can start and stop cleanly", async () => {
      await watcher.start();
      await watcher.stop();
      // Stopping again should be a no-op
      await watcher.stop();
    });

    it("does not emit events after stop", async () => {
      await watcher.start();
      collectEvents();
      await watcher.stop();

      const filePath = path.join(root, "ravel", "tasks", "T0010-test.md");
      fs.writeFileSync(filePath, taskFile("T0010-test.md", "T0010", "new"));

      await sleep(300);
      expect(events).toHaveLength(0);
    });

    it("handles duplicate start calls", async () => {
      await watcher.start();
      collectEvents();

      // Second start should not cause duplicate events
      await watcher.start();

      const filePath = path.join(root, "ravel", "tasks", "T0010-test.md");
      fs.writeFileSync(filePath, taskFile("T0010-test.md", "T0010", "new"));

      await waitForEvents({ count: 1 });
      expect(events).toHaveLength(1);
    });
  });
});
