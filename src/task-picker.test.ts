import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CommandOptions,
  type CommandResult,
  type CommandRunner,
  SystemCommandRunner,
} from "./commands/process.js";
import { TaskPickerState } from "./models/resolved-task.js";
import { TaskPicker } from "./task-picker.js";

interface CommandCall {
  command: string;
  args: readonly string[];
  options: CommandOptions;
}

class FakeCommandRunner implements CommandRunner {
  readonly calls: CommandCall[] = [];

  constructor(
    private readonly gitResult: CommandResult,
    private readonly fzfResult: CommandResult,
  ) {}

  run(
    command: string,
    args: readonly string[],
    options: CommandOptions,
  ): CommandResult {
    this.calls.push({ command, args, options });
    return command === "git" ? this.gitResult : this.fzfResult;
  }
}

function commandResult(
  status: number,
  stdout = "",
  stderr = "",
): CommandResult {
  return { status, stdout, stderr };
}

function createProject(root: string): void {
  fs.mkdirSync(path.join(root, "ravel", "tasks"), { recursive: true });
}

function writeTask(
  root: string,
  filename: string,
  status: "new" | "in-progress" | "review" | "done",
  dependencies: string[] = [],
  title = filename.slice(0, -3),
): string {
  const taskPath = path.join(root, "ravel", "tasks", filename);
  fs.mkdirSync(path.dirname(taskPath), { recursive: true });
  const id = filename.slice(0, filename.indexOf("-"));
  fs.writeFileSync(
    taskPath,
    [
      "---",
      `id: ${id}`,
      `title: ${JSON.stringify(title)}`,
      `status: ${status}`,
      `dependencies: ${JSON.stringify(dependencies)}`,
      "---",
      `Complete body for ${id}`,
      "",
    ].join("\n"),
  );
  return taskPath;
}

function worktreeRecord(
  worktreePath: string,
  branch?: string,
): string[] {
  return [
    `worktree ${worktreePath}`,
    "HEAD abc123",
    ...(branch ? [`branch refs/heads/${branch}`] : ["detached"]),
    "",
  ];
}

describe("TaskPicker", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ravel-picker-test-"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("resolves primary and live states and sends stable searchable rows to fzf", () => {
    const primary = path.join(tmpDir, "primary project");
    const invoked = path.join(tmpDir, "invoked-worktree");
    const progressWorktree = path.join(tmpDir, "custom", "progress");
    const reviewWorktree = path.join(tmpDir, "custom", "review");
    const readyWorktree = path.join(tmpDir, "custom", "ready");
    const dependencyWorktree = path.join(tmpDir, "custom", "dependency");
    const detachedWorktree = path.join(tmpDir, "custom", "detached");
    const unrelatedWorktree = path.join(tmpDir, "custom", "unrelated");
    createProject(primary);
    createProject(invoked);
    fs.mkdirSync(path.join(invoked, "nested", "directory"), { recursive: true });

    writeTask(primary, "T0001-done.md", "done");
    writeTask(primary, "T0002-dependency.md", "new");
    writeTask(primary, "T0003-blocked.md", "new", ["T0002"]);
    writeTask(primary, "T0004-progress.md", "new");
    writeTask(primary, "T0005-review.md", "new");
    writeTask(primary, "T0006-ready.md", "new");
    const exactPrimaryPath = writeTask(
      primary,
      "T0007-exact.md",
      "new",
      [],
      "Exact\tmatch",
    );

    writeTask(dependencyWorktree, "T0002-dependency.md", "done");
    writeTask(progressWorktree, "T0004-progress.md", "in-progress");
    writeTask(reviewWorktree, "T0005-review.md", "review");
    const readyPreview = writeTask(readyWorktree, "T0006-ready.md", "done");

    const porcelain = [
      ...worktreeRecord(primary, "main"),
      ...worktreeRecord(dependencyWorktree, "T0002-dependency"),
      ...worktreeRecord(progressWorktree, "T0004-progress"),
      ...worktreeRecord(reviewWorktree, "T0005-review"),
      ...worktreeRecord(readyWorktree, "T0006-ready"),
      ...worktreeRecord(detachedWorktree),
      ...worktreeRecord(unrelatedWorktree, "T0007-exact-extra"),
      "",
    ].join("\0");
    const commands = new FakeCommandRunner(
      commandResult(0, porcelain),
      commandResult(0, "5\tvisible fields may be different\n"),
    );

    const selected = new TaskPicker(commands).pick(
      path.join(invoked, "nested", "directory"),
    );

    expect(selected?.task.id).toBe("T0003");
    expect(selected?.state).toBe(TaskPickerState.Blocked);
    expect(selected?.incompleteDependencies.map((task) => task.id)).toEqual([
      "T0002",
    ]);

    expect(commands.calls[0]).toMatchObject({
      command: "git",
      args: ["worktree", "list", "--porcelain", "-z"],
      options: { cwd: invoked },
    });
    const fzfCall = commands.calls[1];
    expect(fzfCall.command).toBe("fzf");
    expect(fzfCall.args).toContain("--no-sort");
    expect(fzfCall.args).toContain("--header=Enter: select task | Escape: cancel");
    expect(fzfCall.args).toContain("--with-nth=2..");
    expect(fzfCall.args).toContain("--nth=2..");
    expect(fzfCall.args.some((argument) => argument.includes("tmux"))).toBe(false);

    const visibleRows = fzfCall.options.input
      ?.trimEnd()
      .split("\n")
      .map((row) => row.slice(row.indexOf("\t") + 1));
    expect(visibleRows?.map((row) => row.trimStart().split(/\s+/)[0])).toEqual([
      "merge-ready",
      "merge-ready",
      "review-ready",
      "in-progress",
      "new",
      "blocked",
    ]);
    expect(fzfCall.options.input).toContain("Exact match");
    expect(fzfCall.options.input).not.toContain("Exact\tmatch");

    const preview = fzfCall.args.find((argument) =>
      argument.startsWith("--preview="),
    );
    expect(preview).toContain(`cat '${readyPreview}'`);
    expect(preview).toContain(`cat '${exactPrimaryPath}'`);
  });

  it("quotes preview paths containing spaces and shell metacharacters", () => {
    const project = path.join(tmpDir, "project $value's tasks");
    createProject(project);
    const taskPath = writeTask(project, "T0001-shell-safe.md", "new");
    const commands = new FakeCommandRunner(
      commandResult(1),
      commandResult(0, "0\tignored\n"),
    );

    new TaskPicker(commands).pick(project);

    const preview = commands.calls[1].args.find((argument) =>
      argument.startsWith("--preview="),
    );
    const quotedPath = `'${taskPath.replaceAll("'", "'\"'\"'")}'`;
    expect(preview).toContain(`cat ${quotedPath}`);
  });

  it("falls back to local tasks without Git and treats Escape as success", () => {
    const project = path.join(tmpDir, "local-project");
    createProject(project);
    writeTask(project, "T0001-local.md", "new");
    const commands = new FakeCommandRunner(
      commandResult(1, "", "git unavailable"),
      commandResult(130),
    );

    expect(new TaskPicker(commands).pick(project)).toBeUndefined();
    expect(commands.calls.map((call) => call.command)).toEqual(["git", "fzf"]);
  });

  it("reports no open tasks without spawning fzf", () => {
    const project = path.join(tmpDir, "complete-project");
    createProject(project);
    writeTask(project, "T0001-complete.md", "done");
    const commands = new FakeCommandRunner(
      commandResult(1),
      commandResult(0),
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(new TaskPicker(commands).pick(project)).toBeUndefined();
    expect(log).toHaveBeenCalledWith("No open tasks.");
    expect(commands.calls.map((call) => call.command)).toEqual(["git"]);
  });

  it("fails when a matching registered worktree has no task file", () => {
    const primary = path.join(tmpDir, "primary");
    const missing = path.join(tmpDir, "missing-worktree");
    createProject(primary);
    fs.mkdirSync(missing);
    writeTask(primary, "T0001-missing.md", "new");
    const porcelain = [
      ...worktreeRecord(primary, "main"),
      ...worktreeRecord(missing, "T0001-missing"),
      "",
    ].join("\0");
    const commands = new FakeCommandRunner(
      commandResult(0, porcelain),
      commandResult(0),
    );

    expect(() => new TaskPicker(commands).pick(primary)).toThrow(
      `Worktree for branch T0001-missing at ${missing} has no task file`,
    );
    expect(commands.calls.map((call) => call.command)).toEqual(["git"]);
  });

  it("resolves a renamed worktree task by its unchanged task ID", () => {
    const primary = path.join(tmpDir, "primary");
    const renamedWorktree = path.join(tmpDir, "renamed-worktree");
    createProject(primary);
    writeTask(primary, "T0001-original-name.md", "new");
    const renamedPath = writeTask(
      renamedWorktree,
      "T0001-implementation-name.md",
      "review",
    );
    const porcelain = [
      ...worktreeRecord(primary, "main"),
      ...worktreeRecord(renamedWorktree, "T0001-original-name"),
      "",
    ].join("\0");
    const commands = new FakeCommandRunner(
      commandResult(0, porcelain),
      commandResult(0, "0\tignored\n"),
    );

    const selected = new TaskPicker(commands).pick(primary);

    expect(selected).toMatchObject({
      branchName: "T0001-original-name",
      state: TaskPickerState.ReviewReady,
      previewPath: renamedPath,
    });
    expect(commands.calls[1].args.join("\n")).toContain(renamedPath);
  });

  it("fails when a worktree has multiple renamed files for one task ID", () => {
    const primary = path.join(tmpDir, "primary");
    const ambiguousWorktree = path.join(tmpDir, "ambiguous-worktree");
    createProject(primary);
    writeTask(primary, "T0001-original-name.md", "new");
    writeTask(ambiguousWorktree, "T0001-first-name.md", "review");
    writeTask(ambiguousWorktree, "T0001-second-name.md", "review");
    const porcelain = [
      ...worktreeRecord(primary, "main"),
      ...worktreeRecord(ambiguousWorktree, "T0001-original-name"),
      "",
    ].join("\0");
    const commands = new FakeCommandRunner(
      commandResult(0, porcelain),
      commandResult(0),
    );

    expect(() => new TaskPicker(commands).pick(primary)).toThrow(
      `Worktree for branch T0001-original-name at ${ambiguousWorktree} has multiple task files for T0001`,
    );
    expect(commands.calls.map((call) => call.command)).toEqual(["git"]);
  });

  it("drives fake Git and fzf executables from a linked worktree", () => {
    const executableDir = path.join(tmpDir, "bin");
    const primary = path.join(tmpDir, "primary");
    const linked = path.join(tmpDir, "linked worktree");
    const live = path.join(tmpDir, "outside", "custom live path");
    const gitOutput = path.join(tmpDir, "git-output");
    const fzfArgs = path.join(tmpDir, "fzf-args");
    const fzfInput = path.join(tmpDir, "fzf-input");
    fs.mkdirSync(executableDir);
    createProject(primary);
    createProject(linked);
    fs.mkdirSync(path.join(linked, "nested"), { recursive: true });
    writeTask(primary, "T0001-live.md", "new");
    const liveTaskPath = writeTask(live, "T0001-live.md", "review");
    fs.writeFileSync(
      gitOutput,
      [
        ...worktreeRecord(primary, "main"),
        ...worktreeRecord(live, "T0001-live"),
        "",
      ].join("\0"),
    );
    fs.writeFileSync(
      path.join(executableDir, "git"),
      "#!/bin/sh\n/bin/cat \"$RAVEL_TEST_GIT_OUTPUT\"\n",
      { mode: 0o755 },
    );
    fs.writeFileSync(
      path.join(executableDir, "fzf"),
      [
        "#!/bin/sh",
        ": > \"$RAVEL_TEST_FZF_ARGS\"",
        "for argument in \"$@\"; do",
        "  printf '%s\\n' \"$argument\" >> \"$RAVEL_TEST_FZF_ARGS\"",
        "done",
        ": > \"$RAVEL_TEST_FZF_INPUT\"",
        "selected=",
        "while IFS= read -r line; do",
        "  printf '%s\\n' \"$line\" >> \"$RAVEL_TEST_FZF_INPUT\"",
        "  if [ -z \"$selected\" ]; then selected=$line; fi",
        "done",
        "printf '%s\\n' \"$selected\"",
        "",
      ].join("\n"),
      { mode: 0o755 },
    );

    const originalPath = process.env.PATH;
    process.env.PATH = executableDir;
    process.env.RAVEL_TEST_GIT_OUTPUT = gitOutput;
    process.env.RAVEL_TEST_FZF_ARGS = fzfArgs;
    process.env.RAVEL_TEST_FZF_INPUT = fzfInput;
    try {
      const selected = new TaskPicker(new SystemCommandRunner()).pick(
        path.join(linked, "nested"),
      );

      expect(selected).toMatchObject({
        state: TaskPickerState.ReviewReady,
        previewPath: liveTaskPath,
        worktreePath: live,
      });
      expect(fs.readFileSync(fzfArgs, "utf-8")).toContain("--no-sort\n");
      expect(fs.readFileSync(fzfInput, "utf-8")).toContain(
        "review-ready  T0001",
      );
    } finally {
      process.env.PATH = originalPath;
      delete process.env.RAVEL_TEST_GIT_OUTPUT;
      delete process.env.RAVEL_TEST_FZF_ARGS;
      delete process.env.RAVEL_TEST_FZF_INPUT;
    }
  });
});
