import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  sessionPath,
  readSession,
  writeSession,
  deleteSession,
} from "./session.js";

describe("sessionPath", () => {
  it("returns path under .ravel/sessions/ with taskId.json", () => {
    const p = sessionPath("/my/project", "T0042");
    expect(p).toBe("/my/project/.ravel/sessions/T0042.json");
  });
});

describe("readSession", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join("/tmp", "ravel-session-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns parsed session when file exists", () => {
    writeSession(tmpDir, {
      taskId: "T0042",
      branch: "T0042-my-feature",
      worktreePath: ".worktrees/T0042",
    });

    const session = readSession(tmpDir, "T0042");
    expect(session).toEqual({
      taskId: "T0042",
      branch: "T0042-my-feature",
      worktreePath: ".worktrees/T0042",
    });
  });

  it("returns null when session file does not exist", () => {
    expect(readSession(tmpDir, "T0999")).toBeNull();
  });
});

describe("writeSession", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join("/tmp", "ravel-session-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates the sessions directory and writes JSON file", () => {
    const session = {
      taskId: "T0001",
      branch: "T0001-setup",
      worktreePath: ".worktrees/T0001",
    };

    writeSession(tmpDir, session);

    const filePath = sessionPath(tmpDir, "T0001");
    expect(fs.existsSync(filePath)).toBe(true);

    const raw = fs.readFileSync(filePath, "utf-8");
    expect(JSON.parse(raw)).toEqual(session);
  });

  it("writes pretty-printed JSON with trailing newline", () => {
    writeSession(tmpDir, {
      taskId: "T0002",
      branch: "T0002-build",
      worktreePath: ".worktrees/T0002",
    });

    const raw = fs.readFileSync(sessionPath(tmpDir, "T0002"), "utf-8");
    expect(raw).toBe(JSON.stringify({
      taskId: "T0002",
      branch: "T0002-build",
      worktreePath: ".worktrees/T0002",
    }, null, 2) + "\n");
  });

  it("overwrites an existing session file", () => {
    const filePath = sessionPath(tmpDir, "T0003");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ taskId: "T0003", branch: "old", worktreePath: "old" }));

    writeSession(tmpDir, {
      taskId: "T0003",
      branch: "T0003-new",
      worktreePath: ".worktrees/T0003",
    });

    const session = readSession(tmpDir, "T0003");
    expect(session?.branch).toBe("T0003-new");
  });
});

describe("deleteSession", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join("/tmp", "ravel-session-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("removes the session file when it exists", () => {
    writeSession(tmpDir, {
      taskId: "T0042",
      branch: "T0042-fix",
      worktreePath: ".worktrees/T0042",
    });
    const filePath = sessionPath(tmpDir, "T0042");
    expect(fs.existsSync(filePath)).toBe(true);

    deleteSession(tmpDir, "T0042");

    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("does nothing when session file does not exist", () => {
    expect(() => deleteSession(tmpDir, "T0999")).not.toThrow();
  });
});
