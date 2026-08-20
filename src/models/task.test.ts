import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  parseFilename,
  parseTask,
  TaskCollection,
} from "./task.js";

// ---------------------------------------------------------------------------
// parseFilename
// ---------------------------------------------------------------------------
describe("parseFilename", () => {
  it("parses a valid filename with 4 digits", () => {
    expect(parseFilename("T0001-my-task.md")).toEqual({
      id: "T0001",
      slug: "my-task",
    });
  });

  it("parses a valid filename with more than 4 digits", () => {
    expect(parseFilename("T12345-another-task.md")).toEqual({
      id: "T12345",
      slug: "another-task",
    });
  });

  it("parses a filename with a complex slug", () => {
    expect(parseFilename("T0001-fix-user-auth-flow.md")).toEqual({
      id: "T0001",
      slug: "fix-user-auth-flow",
    });
  });

  it("returns null when missing T prefix", () => {
    expect(parseFilename("0001-my-task.md")).toBeNull();
  });

  it("returns null when fewer than 4 digits", () => {
    expect(parseFilename("T123-task.md")).toBeNull();
  });

  it("returns null when missing .md extension", () => {
    expect(parseFilename("T0001-my-task.txt")).toBeNull();
  });

  it("returns null when no slug after ID", () => {
    expect(parseFilename("T0001-.md")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseTask
// ---------------------------------------------------------------------------
describe("parseTask", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join("/tmp", "ravel-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeTaskFile(
    filename: string,
    frontmatter: Record<string, unknown>,
    body: string = "Task body content.",
  ): string {
    const filePath = path.join(tmpDir, filename);
    const yaml = Object.entries(frontmatter)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join("\n");
    fs.writeFileSync(filePath, `---\n${yaml}\n---\n${body}`);
    return filePath;
  }

  it("parses a valid task file", () => {
    const filePath = writeTaskFile("T0001-my-task.md", {
      id: "T0001",
      title: "My task",
      status: "new",
      dependencies: [],
    });

    const task = parseTask(filePath);
    expect(task.id).toBe("T0001");
    expect(task.title).toBe("My task");
    expect(task.status).toBe("new");
    expect(task.dependencies).toEqual([]);
    expect(task.filename).toBe("T0001-my-task.md");
    expect(task.filePath).toBe(filePath);
  });

  it("throws on invalid filename format", () => {
    const filePath = writeTaskFile("bad-filename.md", {
      id: "T0001",
      title: "Test",
      status: "new",
    });

    expect(() => parseTask(filePath)).toThrow(
      'Invalid task filename: "bad-filename.md"',
    );
  });

  it("throws when frontmatter id does not match filename id", () => {
    const filePath = writeTaskFile("T0002-my-task.md", {
      id: "T0001",
      title: "Test",
      status: "new",
    });

    expect(() => parseTask(filePath)).toThrow(/ID mismatch/);
  });

  it("throws when frontmatter is missing required fields", () => {
    const filePath = writeTaskFile("T0001-my-task.md", {
      id: "T0001",
      // missing title
      status: "new",
    });

    expect(() => parseTask(filePath)).toThrow(/Invalid frontmatter/);
  });

  it("throws on invalid status value", () => {
    const filePath = writeTaskFile("T0001-my-task.md", {
      id: "T0001",
      title: "Test",
      status: "blocked",
    });

    expect(() => parseTask(filePath)).toThrow(/Invalid frontmatter/);
  });

  it("defaults dependencies to empty array when omitted", () => {
    // YAML null for dependencies
    const filePath = path.join(tmpDir, "T0001-my-task.md");
    const content = [
      "---",
      'id: "T0001"',
      'title: "Test"',
      'status: "new"',
      "---",
      "Body",
    ].join("\n");
    fs.writeFileSync(filePath, content);

    const task = parseTask(filePath);
    expect(task.dependencies).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// TaskCollection
// ---------------------------------------------------------------------------
describe("TaskCollection", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join("/tmp", "ravel-test-"));
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
  ): void {
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
    fs.writeFileSync(
      path.join(tmpDir, filename),
      `---\n${yaml}\n---\nBody for ${id}`,
    );
  }

  it("loads all tasks from a directory", () => {
    writeTask("T0001", "setup");
    writeTask("T0002", "parse");
    writeTask("T0003", "build");

    const collection = TaskCollection.load(tmpDir);
    expect(collection.list()).toHaveLength(3);
  });

  it("skips non-markdown files in the directory", () => {
    writeTask("T0001", "setup");
    fs.writeFileSync(path.join(tmpDir, "README.md"), "just a readme"); // no frontmatter, should fail to parse

    expect(() => TaskCollection.load(tmpDir)).toThrow(/Failed to parse/);
  });

  it("throws when directory does not exist", () => {
    expect(() => TaskCollection.load("/tmp/does-not-exist-xyz")).toThrow(
      /Tasks directory not found/,
    );
  });

  it("throws when a dependency references a missing task", () => {
    writeTask("T0001", "setup", { dependencies: ["T0999"] });

    expect(() => TaskCollection.load(tmpDir)).toThrow(/depends on T0999/);
  });

  it("get returns a task by id", () => {
    writeTask("T0001", "setup");
    const collection = TaskCollection.load(tmpDir);

    expect(collection.get("T0001")?.title).toBe("Task T0001");
  });

  it("get returns undefined for unknown id", () => {
    writeTask("T0001", "setup");
    const collection = TaskCollection.load(tmpDir);

    expect(collection.get("T0999")).toBeUndefined();
  });

  it("list returns all tasks", () => {
    writeTask("T0001", "a");
    writeTask("T0002", "b");
    const collection = TaskCollection.load(tmpDir);

    const ids = collection
      .list()
      .map((t) => t.id)
      .sort();
    expect(ids).toEqual(["T0001", "T0002"]);
  });

  // -- isBlocked ---------------------------------------------------------
  it("isBlocked returns true when new and a dependency is not done", () => {
    writeTask("T0001", "a", { status: "new" });
    writeTask("T0002", "b", { status: "new", dependencies: ["T0001"] });
    const collection = TaskCollection.load(tmpDir);

    const t2 = collection.get("T0002")!;
    expect(collection.isBlocked(t2)).toBe(true);
  });

  it("isBlocked returns false when new and all dependencies are done", () => {
    writeTask("T0001", "a", { status: "done" });
    writeTask("T0002", "b", { status: "new", dependencies: ["T0001"] });
    const collection = TaskCollection.load(tmpDir);

    const t2 = collection.get("T0002")!;
    expect(collection.isBlocked(t2)).toBe(false);
  });

  it("isBlocked returns false for a task with no dependencies", () => {
    writeTask("T0001", "a", { status: "new" });
    const collection = TaskCollection.load(tmpDir);

    const t1 = collection.get("T0001")!;
    expect(collection.isBlocked(t1)).toBe(false);
  });

  it("isBlocked returns false when status is done (even if deps not done)", () => {
    writeTask("T0001", "a", { status: "new" });
    writeTask("T0002", "b", { status: "done", dependencies: ["T0001"] });
    const collection = TaskCollection.load(tmpDir);

    const t2 = collection.get("T0002")!;
    expect(collection.isBlocked(t2)).toBe(false);
  });

  // -- getBlockedTasks ---------------------------------------------------
  it("getBlockedTasks returns only blocked tasks", () => {
    writeTask("T0001", "a", { status: "done" });
    writeTask("T0002", "b", { status: "new", dependencies: ["T0001"] }); // unblocked
    writeTask("T0003", "c", { status: "new", dependencies: ["T0002"] }); // blocked (T0002 not done)
    const collection = TaskCollection.load(tmpDir);

    const blocked = collection.getBlockedTasks().map((t) => t.id);
    expect(blocked).toEqual(["T0003"]);
  });

  // -- getByStatus -------------------------------------------------------
  it("getByStatus filters tasks by status", () => {
    writeTask("T0001", "a", { status: "done" });
    writeTask("T0002", "b", { status: "new" });
    writeTask("T0003", "c", { status: "new" });
    const collection = TaskCollection.load(tmpDir);

    expect(collection.getByStatus("done").map((t) => t.id)).toEqual(["T0001"]);
    expect(collection.getByStatus("new").map((t) => t.id)).toEqual([
      "T0002",
      "T0003",
    ]);
  });

  // -- getDependents -----------------------------------------------------
  it("getDependents returns tasks that depend on the given task", () => {
    writeTask("T0001", "a");
    writeTask("T0002", "b", { dependencies: ["T0001"] });
    writeTask("T0003", "c", { dependencies: ["T0001"] });
    writeTask("T0004", "d", { dependencies: ["T0002"] });
    const collection = TaskCollection.load(tmpDir);

    const deps = collection
      .getDependents("T0001")
      .map((t) => t.id)
      .sort();
    expect(deps).toEqual(["T0002", "T0003"]);
  });

  it("getDependents returns empty array when no tasks depend on the given id", () => {
    writeTask("T0001", "a");
    const collection = TaskCollection.load(tmpDir);

    expect(collection.getDependents("T0001")).toEqual([]);
  });
});
