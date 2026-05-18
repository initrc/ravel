import { describe, it, expect } from "vitest";
import { formatEvent, parseCommand } from "./app.js";

// ---------------------------------------------------------------------------
// formatEvent
// ---------------------------------------------------------------------------
describe("formatEvent", () => {
  it("formats task-status-changed to 'review'", () => {
    expect(
      formatEvent({
        type: "task-status-changed",
        taskId: "T0042",
        oldStatus: "in-progress",
        newStatus: "review",
        filePath: "/tmp/T0042-test.md",
      }),
    ).toBe("T0042 is ready for review");
  });

  it("formats task-status-changed to 'done' on the main branch", () => {
    expect(
      formatEvent({
        type: "task-status-changed",
        taskId: "T0033",
        oldStatus: "in-progress",
        newStatus: "done",
        filePath: "/Users/user/code/ravel/ravel/tasks/T0033.md",
      }),
    ).toBe("T0033 is done on the main branch");
  });

  it("formats task-status-changed to 'done' on a worktree branch", () => {
    expect(
      formatEvent({
        type: "task-status-changed",
        taskId: "T0033",
        oldStatus: "in-progress",
        newStatus: "done",
        filePath:
          "/Users/user/code/ravel/.worktrees/T0033-rebase-conflict-amend/ravel/tasks/T0033.md",
      }),
    ).toBe(
      "T0033 is done on the T0033-rebase-conflict-amend branch",
    );
  });

  it("formats task-status-changed to other statuses", () => {
    expect(
      formatEvent({
        type: "task-status-changed",
        taskId: "T0001",
        oldStatus: "new",
        newStatus: "in-progress",
        filePath: "/tmp/T0001-test.md",
      }),
    ).toBe("T0001 is in-progress");
  });

  it("formats task-created", () => {
    expect(
      formatEvent({
        type: "task-created",
        taskId: "T0002",
        filename: "T0002-build.md",
      }),
    ).toBe("T0002 is created");
  });

  it("formats doc-created", () => {
    expect(
      formatEvent({
        type: "doc-created",
        filename: "README.md",
      }),
    ).toBe("README.md is created");
  });

  it("formats session-registered", () => {
    expect(
      formatEvent({
        type: "session-registered",
        taskId: "T0042",
        sessionPath: "/tmp/.ravel/sessions/T0042.json",
      }),
    ).toBe("T0042 session registered");
  });
});

// ---------------------------------------------------------------------------
// parseCommand
// ---------------------------------------------------------------------------
describe("parseCommand", () => {
  describe("exit", () => {
    it("parses /exit", () => {
      expect(parseCommand("/exit")).toEqual({ type: "exit" });
    });

    it("parses /quit", () => {
      expect(parseCommand("/quit")).toEqual({ type: "exit" });
    });
  });

  describe("help", () => {
    it("parses /help", () => {
      expect(parseCommand("/help")).toEqual({ type: "help" });
    });
  });

  describe("config", () => {
    it("parses /config", () => {
      expect(parseCommand("/config")).toEqual({ type: "config" });
    });
  });

  describe("assign", () => {
    it("parses /assign with a task ID", () => {
      expect(parseCommand("/assign T0042")).toEqual({
        type: "assign",
        taskId: "T0042",
      });
    });

    it("parses /assign with extra whitespace", () => {
      expect(parseCommand("/assign  T0042  extra")).toEqual({
        type: "assign",
        taskId: "T0042",
      });
    });

    it("returns unknown when /assign has no task ID", () => {
      expect(parseCommand("/assign")).toEqual({
        type: "unknown",
        raw: "/assign",
      });
    });
  });

  describe("integrate", () => {
    it("parses /integrate with a task ID", () => {
      expect(parseCommand("/integrate T0042")).toEqual({
        type: "integrate",
        taskId: "T0042",
      });
    });

    it("returns unknown when /integrate has no task ID", () => {
      expect(parseCommand("/integrate")).toEqual({
        type: "unknown",
        raw: "/integrate",
      });
    });
  });

  describe("unknown", () => {
    it("parses unrecognized commands", () => {
      expect(parseCommand("/foobar")).toEqual({
        type: "unknown",
        raw: "/foobar",
      });
    });

    it("handles empty string", () => {
      expect(parseCommand("")).toEqual({ type: "unknown", raw: "" });
    });

    it("handles plain text (not a command)", () => {
      expect(parseCommand("hello world")).toEqual({
        type: "unknown",
        raw: "hello",
      });
    });
  });
});
