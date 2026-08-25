import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const PROJECT_ROOT = path.join(import.meta.dirname, "..");
const RAVEL_EXECUTABLE = path.join(PROJECT_ROOT, "bin", "ravel.js");
const PACKAGE_VERSION = (
  JSON.parse(
    fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8"),
  ) as { version: string }
).version;

interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function createProject(root: string): void {
  fs.mkdirSync(path.join(root, "ravel", "tasks"), { recursive: true });
}

function writeTask(
  root: string,
  filename: string,
  status: "new" | "in-progress" | "review" | "done",
  dependencies: string[] = [],
): string {
  const taskPath = path.join(root, "ravel", "tasks", filename);
  fs.mkdirSync(path.dirname(taskPath), { recursive: true });
  const id = filename.slice(0, filename.indexOf("-"));
  const title = filename.slice(filename.indexOf("-") + 1, -3);
  fs.writeFileSync(
    taskPath,
    [
      "---",
      `id: ${id}`,
      `title: ${title}`,
      `status: ${status}`,
      `dependencies: ${JSON.stringify(dependencies)}`,
      "---",
      `Complete body for ${id}`,
      "",
    ].join("\n"),
  );
  return taskPath;
}

function worktreeRecord(worktreePath: string, branch: string): string[] {
  return [
    `worktree ${worktreePath}`,
    "HEAD abc123",
    `branch refs/heads/${branch}`,
    "",
  ];
}

describe("the built ravel executable", () => {
  let tempDirectory: string;
  let executableDirectory: string;
  let environment: NodeJS.ProcessEnv;
  let gitOutputPath: string;
  let fzfInputPath: string;
  let fzfArgumentsPath: string;
  let workmuxArgumentsPath: string;
  let clipboardPath: string;
  let commandLogPath: string;

  beforeEach(() => {
    expect(fs.existsSync(RAVEL_EXECUTABLE)).toBe(true);
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ravel-e2e-"));
    executableDirectory = path.join(tempDirectory, "executables");
    fs.mkdirSync(executableDirectory);

    gitOutputPath = path.join(tempDirectory, "git-output");
    fzfInputPath = path.join(tempDirectory, "fzf-input");
    fzfArgumentsPath = path.join(tempDirectory, "fzf-arguments.json");
    workmuxArgumentsPath = path.join(tempDirectory, "workmux-arguments.json");
    clipboardPath = path.join(tempDirectory, "clipboard");
    commandLogPath = path.join(tempDirectory, "commands.log");
    fs.writeFileSync(gitOutputPath, "");

    createFakeExecutables(executableDirectory);
    environment = {
      ...process.env,
      PATH: executableDirectory,
      RAVEL_E2E_COMMAND_LOG: commandLogPath,
      RAVEL_E2E_GIT_OUTPUT: gitOutputPath,
      RAVEL_E2E_GIT_LIST_STATUS: "1",
      RAVEL_E2E_FZF_INPUT: fzfInputPath,
      RAVEL_E2E_FZF_ARGUMENTS: fzfArgumentsPath,
      RAVEL_E2E_FZF_SELECTION: "T0001",
      RAVEL_E2E_WORKMUX_ARGUMENTS: workmuxArgumentsPath,
      RAVEL_E2E_CLIPBOARD: clipboardPath,
    };
  });

  afterEach(() => {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  it("runs through a package-manager binary symlink", () => {
    const linkedExecutable = path.join(tempDirectory, "ravel");
    fs.symlinkSync(RAVEL_EXECUTABLE, linkedExecutable);

    const result = runRavel(
      ["--version"],
      tempDirectory,
      environment,
      linkedExecutable,
    );

    expect(result).toEqual({
      status: 0,
      stdout: `${PACKAGE_VERSION}\n`,
      stderr: "",
    });
  });

  it("initializes the complete v2 project surface", () => {
    const project = path.join(tempDirectory, "initialized-project");
    fs.mkdirSync(project);
    fs.writeFileSync(path.join(project, "AGENTS.md"), "# Existing guidance\n");

    const result = runRavel(["init"], project, environment);

    expect(result).toMatchObject({ status: 0, stderr: "" });
    expect(fs.readdirSync(path.join(project, "ravel")).sort()).toEqual([
      "docs",
      "tasks",
    ]);
    expect(
      fs.readFileSync(
        path.join(project, "ravel", "docs", "ravel-conventions.md"),
        "utf8",
      ),
    ).toContain("# Ravel Conventions");
    expect(fs.readFileSync(path.join(project, "AGENTS.md"), "utf8"))
      .toContain("# Existing guidance");
    expect(fs.existsSync(path.join(project, ".ravel"))).toBe(false);
    expect(fs.existsSync(path.join(project, ".gitignore"))).toBe(false);
  });

  it("reports every doctor check and distinguishes both exit paths", () => {
    const project = path.join(tempDirectory, "doctor-project");
    fs.mkdirSync(project);

    const healthy = runRavel(["doctor"], project, environment);

    expect(healthy.status).toBe(0);
    expect(healthy.stdout).toContain("PASSED [mandatory] fzf: fake fzf 1.0");
    expect(healthy.stdout).toContain("PASSED [recommended] Git: fake Git 1.0");
    expect(healthy.stdout).toContain("PASSED [recommended] tmux: fake tmux 1.0");
    expect(healthy.stdout).toContain(
      "PASSED [recommended] workmux: fake workmux 1.0",
    );

    const recommendedFailure = runRavel(["doctor"], project, {
      ...environment,
      RAVEL_E2E_WORKMUX_VERSION_STATUS: "7",
    });
    expect(recommendedFailure.status).toBe(0);
    expect(recommendedFailure.stdout).toContain(
      "FAILED [recommended] workmux: fake workmux unavailable",
    );

    fs.writeFileSync(commandLogPath, "");
    const mandatoryFailure = runRavel(["doctor"], project, {
      ...environment,
      RAVEL_E2E_FZF_VERSION_STATUS: "9",
    });
    expect(mandatoryFailure.status).toBe(1);
    expect(mandatoryFailure.stdout).toContain(
      "FAILED [mandatory] fzf: fake fzf unavailable",
    );
    expect(fs.readFileSync(commandLogPath, "utf8").trim().split("\n"))
      .toHaveLength(4);
  });

  it("discovers primary tasks from a linked project and delegates safely", () => {
    const primary = path.join(tempDirectory, "primary project");
    const linked = path.join(tempDirectory, "linked project");
    const progress = path.join(tempDirectory, "live", "progress");
    const review = path.join(tempDirectory, "live", "review");
    const mergeReady = path.join(tempDirectory, "live", "merge-ready");
    createProject(primary);
    createProject(linked);
    fs.mkdirSync(path.join(linked, "nested", "directory"), { recursive: true });

    writeTask(primary, "T0001-complete.md", "done");
    writeTask(primary, "T0002-dependency.md", "new");
    writeTask(primary, "T0003-blocked.md", "new", ["T0002"]);
    writeTask(primary, "T0004-progress.md", "new");
    writeTask(primary, "T0005-review.md", "new");
    writeTask(primary, "T0006-merge.md", "new");
    writeTask(progress, "T0004-progress.md", "in-progress");
    writeTask(review, "T0005-review.md", "review");
    writeTask(mergeReady, "T0006-merge.md", "done");

    fs.writeFileSync(
      gitOutputPath,
      [
        ...worktreeRecord(primary, "main"),
        ...worktreeRecord(linked, "current-linked-branch"),
        ...worktreeRecord(progress, "T0004-progress"),
        ...worktreeRecord(review, "T0005-review"),
        ...worktreeRecord(mergeReady, "T0006-merge"),
        "",
      ].join("\0"),
    );

    const result = runRavel([], path.join(linked, "nested", "directory"), {
      ...environment,
      RAVEL_E2E_GIT_LIST_STATUS: "0",
      RAVEL_E2E_FZF_SELECTION: "T0005",
    });

    expect(result.status).toBe(0);
    const pickerRows = fs
      .readFileSync(fzfInputPath, "utf8")
      .trimEnd()
      .split("\n")
      .map((row) => row.slice(row.indexOf("\t") + 1).trimStart());
    expect(pickerRows.map((row) => row.split(/\s+/)[0])).toEqual([
      "merge-ready",
      "review-ready",
      "in-progress",
      "new",
      "blocked",
    ]);
    expect(JSON.parse(fs.readFileSync(fzfArgumentsPath, "utf8"))).toContain(
      "--no-sort",
    );

    const workmuxArguments = JSON.parse(
      fs.readFileSync(workmuxArgumentsPath, "utf8"),
    ) as string[];
    expect(workmuxArguments.slice(0, 4)).toEqual([
      "add",
      "T0005-review",
      "--open-if-exists",
      "--prompt",
    ]);
    expect(workmuxArguments[4]).toContain("You are working on task T0005.");
    expect(workmuxArguments[4]).toContain("launched in `workmux` mode");
    expect(workmuxArguments[4]).toContain(
      "`ravel/docs/ravel-conventions.md`",
    );
    expect(workmuxArguments[4]).not.toContain("notify-send");
    expect(workmuxArguments[4]).not.toContain("osascript");
    expect(workmuxArguments[4]).not.toContain("allow-passthrough");
    expect(fs.existsSync(clipboardPath)).toBe(false);
  });

  it("leaves cancellation and blocked selection mutation-free", () => {
    const project = path.join(tempDirectory, "selection-project");
    createProject(project);
    writeTask(project, "T0001-dependency.md", "new");
    const blockedPath = writeTask(
      project,
      "T0002-blocked.md",
      "new",
      ["T0001"],
    );
    const before = fs.readFileSync(blockedPath, "utf8");

    const cancelled = runRavel([], project, {
      ...environment,
      RAVEL_E2E_FZF_SELECTION: "cancel",
    });
    expect(cancelled.status).toBe(0);

    const blocked = runRavel([], project, {
      ...environment,
      RAVEL_E2E_FZF_SELECTION: "T0002",
    });
    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain(
      "T0002 is blocked by incomplete dependencies: T0001 (dependency)",
    );
    expect(fs.readFileSync(blockedPath, "utf8")).toBe(before);
    expect(fs.existsSync(workmuxArgumentsPath)).toBe(false);
    expect(fs.existsSync(clipboardPath)).toBe(false);
  });

  it("reopens merge-ready work without an implementation prompt", () => {
    const primary = path.join(tempDirectory, "merge-primary");
    const worktree = path.join(tempDirectory, "merge-worktree");
    createProject(primary);
    writeTask(primary, "T0001-finished.md", "new");
    writeTask(worktree, "T0001-finished.md", "done");
    fs.writeFileSync(
      gitOutputPath,
      [
        ...worktreeRecord(primary, "main"),
        ...worktreeRecord(worktree, "T0001-finished"),
        "",
      ].join("\0"),
    );

    const result = runRavel([], primary, {
      ...environment,
      RAVEL_E2E_GIT_LIST_STATUS: "0",
    });

    expect(result.status).toBe(0);
    expect(
      JSON.parse(fs.readFileSync(workmuxArgumentsPath, "utf8")),
    ).toEqual(["add", "T0001-finished", "--open-if-exists"]);
    expect(fs.existsSync(clipboardPath)).toBe(false);

    fs.rmSync(workmuxArgumentsPath);
    const manualResume = runRavel([], primary, {
      ...environment,
      RAVEL_E2E_GIT_LIST_STATUS: "0",
      RAVEL_E2E_WORKMUX_VERSION_STATUS: "7",
    });
    expect(manualResume.status).toBe(0);
    expect(manualResume.stdout).toContain(
      `T0001 is merge-ready on branch T0001-finished at ${worktree}.`,
    );
    expect(fs.existsSync(workmuxArgumentsPath)).toBe(false);
    expect(fs.existsSync(clipboardPath)).toBe(false);
  });

  it("copies and prints the manual prompt when a workflow tool is unavailable", () => {
    const project = path.join(tempDirectory, "manual-project");
    createProject(project);
    const nestedDirectory = path.join(project, "nested", "directory");
    fs.mkdirSync(nestedDirectory, { recursive: true });
    const taskPath = writeTask(project, "T0001-manual.md", "new");
    const before = fs.readFileSync(taskPath, "utf8");

    const result = runRavel([], nestedDirectory, {
      ...environment,
      RAVEL_E2E_WORKMUX_VERSION_STATUS: "7",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("Unavailable workflow tools: workmux.");
    const copiedPrompt = fs.readFileSync(clipboardPath, "utf8");
    expect(result.stdout).toContain(`Prompt for AI agent:\n\n${copiedPrompt}`);
    expect(copiedPrompt).toContain("launched in `manual` mode");
    expect(copiedPrompt).toContain("Follow the `manual` workflow");
    expect(copiedPrompt).not.toContain("`workmux ");
    expect(fs.existsSync(workmuxArgumentsPath)).toBe(false);
    expect(fs.readFileSync(taskPath, "utf8")).toBe(before);
  });

  it("preserves workmux failure status and uses the manual fallback", () => {
    const project = path.join(tempDirectory, "failed-launch-project");
    createProject(project);
    writeTask(project, "T0001-launch.md", "new");

    const result = runRavel([], project, {
      ...environment,
      RAVEL_E2E_WORKMUX_ADD_STATUS: "23",
      RAVEL_E2E_WORKMUX_OUTPUT: "1",
    });

    expect(result.status).toBe(23);
    expect(result.stdout).toContain("fake workmux output");
    expect(result.stderr).toContain("fake workmux error");
    expect(result.stderr).toContain("workmux exited with status 23.");
    expect(JSON.parse(fs.readFileSync(workmuxArgumentsPath, "utf8")))
      .toContain("--prompt");
    expect(fs.readFileSync(clipboardPath, "utf8")).toContain(
      "launched in `manual` mode",
    );
  });

  it.each(["assign", "prompt", "integrate", "cleanup"])(
    "rejects the removed v1 %s subcommand",
    (subcommand) => {
      const project = path.join(tempDirectory, "unsupported-project");
      fs.mkdirSync(project, { recursive: true });

      const result = runRavel([subcommand], project, environment);

      expect(result.status).toBe(1);
      expect(result.stderr).toBe(
        "Usage: ravel [init|doctor|--help|--version]\n",
      );
    },
  );
});

function runRavel(
  args: readonly string[],
  cwd: string,
  environment: NodeJS.ProcessEnv,
  executable = RAVEL_EXECUTABLE,
): CliResult {
  const result = spawnSync(process.execPath, [executable, ...args], {
    cwd,
    env: environment,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function createFakeExecutables(directory: string): void {
  writeExecutable(
    directory,
    "fzf",
    `
if (args[0] === "--version") {
  const status = Number(process.env.RAVEL_E2E_FZF_VERSION_STATUS ?? "0");
  console.log(status === 0 ? "fake fzf 1.0" : "fake fzf unavailable");
  process.exit(status);
}
const input = fs.readFileSync(0, "utf8");
fs.writeFileSync(process.env.RAVEL_E2E_FZF_INPUT, input);
fs.writeFileSync(process.env.RAVEL_E2E_FZF_ARGUMENTS, JSON.stringify(args));
const selection = process.env.RAVEL_E2E_FZF_SELECTION;
if (selection === "cancel") process.exit(130);
const selectedRow = input.split("\\n").find((row) => row.includes(selection));
if (selectedRow) process.stdout.write(selectedRow + "\\n");
`,
  );
  writeExecutable(
    directory,
    "git",
    `
if (args[0] === "--version") {
  console.log("fake Git 1.0");
  process.exit(0);
}
const status = Number(process.env.RAVEL_E2E_GIT_LIST_STATUS ?? "1");
if (status === 0) process.stdout.write(fs.readFileSync(process.env.RAVEL_E2E_GIT_OUTPUT));
process.exit(status);
`,
  );
  writeExecutable(
    directory,
    "tmux",
    `
console.log("fake tmux 1.0");
`,
  );
  writeExecutable(
    directory,
    "workmux",
    `
if (args[0] === "--version") {
  const status = Number(process.env.RAVEL_E2E_WORKMUX_VERSION_STATUS ?? "0");
  console.log(status === 0 ? "fake workmux 1.0" : "fake workmux unavailable");
  process.exit(status);
}
fs.writeFileSync(process.env.RAVEL_E2E_WORKMUX_ARGUMENTS, JSON.stringify(args));
if (process.env.RAVEL_E2E_WORKMUX_OUTPUT === "1") {
  console.log("fake workmux output");
  console.error("fake workmux error");
}
process.exit(Number(process.env.RAVEL_E2E_WORKMUX_ADD_STATUS ?? "0"));
`,
  );
  writeExecutable(
    directory,
    "pbcopy",
    `
fs.writeFileSync(process.env.RAVEL_E2E_CLIPBOARD, fs.readFileSync(0));
`,
  );
}

function writeExecutable(
  directory: string,
  name: string,
  implementation: string,
): void {
  const source = `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
if (process.env.RAVEL_E2E_COMMAND_LOG) {
  fs.appendFileSync(
    process.env.RAVEL_E2E_COMMAND_LOG,
    ${JSON.stringify(name)} + " " + JSON.stringify(args) + "\\n",
  );
}
${implementation}`;
  fs.writeFileSync(path.join(directory, name), source, { mode: 0o755 });
}
