import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import {
  type CommandOptions,
  type CommandResult,
  type CommandRunner,
  SystemCommandRunner,
} from "./commands/process.js";
import { CheckItem, CheckLevel, CheckState } from "./doctor/check.js";
import { Doctor, DoctorDisplay } from "./doctor/doctor.js";
import {
  ResolvedTask,
  TaskPickerState,
} from "./models/resolved-task.js";
import type { Task } from "./models/task.js";
import { TaskLauncher } from "./task-launcher.js";

interface CommandCall {
  command: string;
  args: readonly string[];
  options: CommandOptions;
}

class RecordingCommandRunner implements CommandRunner {
  readonly calls: CommandCall[] = [];

  constructor(private readonly result: CommandResult = commandResult(0)) {}

  run(
    command: string,
    args: readonly string[],
    options: CommandOptions,
  ): CommandResult {
    this.calls.push({ command, args, options });
    return this.result;
  }
}

function commandResult(
  status: number | null,
  error?: Error,
): CommandResult {
  return { status, stdout: "", stderr: "", error };
}

function fakeCheck(
  name: string,
  state: CheckState,
  output = "",
): CheckItem {
  const check = new CheckItem(
    name,
    CheckLevel.Recommended,
    name,
    ["--version"],
  );
  vi.spyOn(check, "run").mockImplementation(() => {
    check.state = state;
    return output;
  });
  return check;
}

function doctorWith(
  overrides: Partial<Record<"Git" | "tmux" | "workmux", CheckState>> = {},
): Doctor {
  return new Doctor([
    fakeCheck("Git", overrides.Git ?? CheckState.Passed),
    fakeCheck("tmux", overrides.tmux ?? CheckState.Passed),
    fakeCheck("workmux", overrides.workmux ?? CheckState.Passed),
  ]);
}

function makeTask(): Task {
  return {
    id: "T0045",
    title: "Delegate launching to workmux",
    status: "new",
    dependencies: ["T0044"],
    filename: "T0045-delegate-launching-to-workmux.md",
    filePath: "/repo/ravel/tasks/T0045-delegate-launching-to-workmux.md",
  };
}

function makeResolvedTask(
  state: TaskPickerState = TaskPickerState.New,
  branchName = "T0045-delegate-launching-to-workmux",
): ResolvedTask {
  const task = makeTask();
  return new ResolvedTask(
    task,
    branchName,
    state,
    task.filePath,
    [],
    state === TaskPickerState.MergeReady
      ? "/repo/.worktrees/T0045-delegate-launching-to-workmux"
      : undefined,
  );
}

function promptPrintedBy(log: MockInstance<typeof console.log>): string {
  const call = log.mock.calls.find(
    ([message]) =>
      typeof message === "string" && message.startsWith("Prompt for AI agent:"),
  );
  return String(call?.[0]).slice("Prompt for AI agent:\n\n".length);
}

describe("TaskLauncher", () => {
  const clipboardWriter = vi.fn<(text: string) => Promise<void>>();
  let log: MockInstance<typeof console.log>;
  let error: MockInstance<typeof console.error>;

  beforeEach(() => {
    vi.restoreAllMocks();
    clipboardWriter.mockReset();
    clipboardWriter.mockResolvedValue();
    log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it.each([
    [TaskPickerState.New, true],
    [TaskPickerState.InProgress, false],
    [TaskPickerState.ReviewReady, false],
  ] as const)(
    "delegates a %s task with the workmux prompt",
    async (state, expectsStartingInstruction) => {
      const doctor = doctorWith();
      const check = vi.spyOn(doctor, "check");
      const commands = new RecordingCommandRunner();
      const launcher = new TaskLauncher(
        doctor,
        commands,
        clipboardWriter,
      );

      await expect(launcher.launch(makeResolvedTask(state), "/repo")).resolves
        .toBe(0);

      expect(check).toHaveBeenCalledWith(
        CheckLevel.Recommended,
        DoctorDisplay.Issues,
      );
      expect(commands.calls).toHaveLength(1);
      const call = commands.calls[0];
      expect(call.command).toBe("workmux");
      expect(call.args.slice(0, 4)).toEqual([
        "add",
        "T0045-delegate-launching-to-workmux",
        "--open-if-exists",
        "--prompt",
      ]);
      expect(call.options).toEqual({ cwd: "/repo", inheritStdio: true });
      const prompt = call.args[4];
      expect(prompt).toContain("Run `workmux rebase`");
      expect(prompt.includes("update the task status from `new` to `in-progress`"))
        .toBe(expectsStartingInstruction);
      expect(clipboardWriter).not.toHaveBeenCalled();
    },
  );

  it("passes a branch-like value as one argument without adding lifecycle options", async () => {
    const branchName = "T0045-name; touch /tmp/not-run";
    const commands = new RecordingCommandRunner();
    const launcher = new TaskLauncher(
      doctorWith(),
      commands,
      clipboardWriter,
    );

    await launcher.launch(makeResolvedTask(TaskPickerState.New, branchName), "/repo");

    expect(commands.calls[0].args[1]).toBe(branchName);
    expect(commands.calls[0].args).toHaveLength(5);
    expect(commands.calls[0].args.join("\n")).not.toContain("base_branch");
    expect(commands.calls[0].args.join("\n")).not.toContain("worktree-dir");
    expect(commands.calls[0].args.join("\n")).not.toContain("agent-command");
  });

  it("runs a fake workmux executable with safe arguments and preserves its status", async () => {
    const tempDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "ravel-workmux-test-"),
    );
    const executablePath = path.join(tempDirectory, "workmux");
    const argumentsPath = path.join(tempDirectory, "arguments.json");
    const unexpectedPath = path.join(tempDirectory, "shell-ran");
    const originalPath = process.env.PATH;
    const branchName = `T0045-safe;touch ${unexpectedPath}`;
    fs.writeFileSync(
      executablePath,
      [
        `#!${process.execPath}`,
        'const fs = require("node:fs");',
        `fs.writeFileSync(${JSON.stringify(argumentsPath)}, JSON.stringify(process.argv.slice(2)));`,
        "process.exitCode = 31;",
        "",
      ].join("\n"),
      { mode: 0o755 },
    );
    process.env.PATH = `${tempDirectory}${path.delimiter}${originalPath ?? ""}`;
    const launcher = new TaskLauncher(
      doctorWith(),
      new SystemCommandRunner(),
      clipboardWriter,
    );

    try {
      await expect(
        launcher.launch(
          makeResolvedTask(TaskPickerState.New, branchName),
          tempDirectory,
        ),
      ).resolves.toBe(31);

      const receivedArguments = JSON.parse(
        fs.readFileSync(argumentsPath, "utf8"),
      ) as string[];
      expect(receivedArguments.slice(0, 4)).toEqual([
        "add",
        branchName,
        "--open-if-exists",
        "--prompt",
      ]);
      expect(receivedArguments[4]).toContain("Run `workmux rebase`");
      expect(fs.existsSync(unexpectedPath)).toBe(false);
    } finally {
      process.env.PATH = originalPath;
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it.each(["Git", "tmux", "workmux"] as const)(
    "uses the manual prompt when %s is unavailable",
    async (tool) => {
      const commands = new RecordingCommandRunner();
      const launcher = new TaskLauncher(
        doctorWith({ [tool]: CheckState.Failed }),
        commands,
        clipboardWriter,
      );

      await expect(launcher.launch(makeResolvedTask(), "/repo")).resolves.toBe(0);

      expect(commands.calls).toHaveLength(0);
      expect(error).toHaveBeenCalledWith(`Unavailable workflow tools: ${tool}.`);
      expect(clipboardWriter).toHaveBeenCalledOnce();
      const copiedPrompt = String(clipboardWriter.mock.calls[0][0]);
      expect(copiedPrompt).toBe(promptPrintedBy(log));
      expect(copiedPrompt).toContain("user-owned integration and cleanup");
      expect(copiedPrompt).not.toContain("`workmux ");
      expect(log).toHaveBeenCalledWith(
        "Prompt copied to the clipboard. Open an AI agent manually and paste it.",
      );
    },
  );

  it("names every unavailable workflow tool", async () => {
    const launcher = new TaskLauncher(
      doctorWith({
        Git: CheckState.Failed,
        tmux: CheckState.Failed,
        workmux: CheckState.Failed,
      }),
      new RecordingCommandRunner(),
      clipboardWriter,
    );

    await launcher.launch(makeResolvedTask(), "/repo");

    expect(error).toHaveBeenCalledWith(
      "Unavailable workflow tools: Git, tmux, workmux.",
    );
  });

  it("reopens merge-ready work without generating or copying a prompt", async () => {
    const commands = new RecordingCommandRunner();
    const launcher = new TaskLauncher(
      doctorWith(),
      commands,
      clipboardWriter,
    );

    await expect(
      launcher.launch(makeResolvedTask(TaskPickerState.MergeReady), "/repo"),
    ).resolves.toBe(0);

    expect(commands.calls[0].args).toEqual([
      "add",
      "T0045-delegate-launching-to-workmux",
      "--open-if-exists",
    ]);
    expect(clipboardWriter).not.toHaveBeenCalled();
  });

  it("prints the registered branch and path for merge-ready fallback", async () => {
    const launcher = new TaskLauncher(
      doctorWith({ workmux: CheckState.Failed }),
      new RecordingCommandRunner(),
      clipboardWriter,
    );

    await launcher.launch(makeResolvedTask(TaskPickerState.MergeReady), "/repo");

    expect(clipboardWriter).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      "T0045 is merge-ready on branch T0045-delegate-launching-to-workmux at /repo/.worktrees/T0045-delegate-launching-to-workmux. Open that worktree manually to inspect it or resume integration.",
    );
  });

  it("preserves a workmux failure status and falls back to the manual prompt", async () => {
    const commands = new RecordingCommandRunner(commandResult(23));
    const launcher = new TaskLauncher(
      doctorWith(),
      commands,
      clipboardWriter,
    );

    await expect(launcher.launch(makeResolvedTask(), "/repo")).resolves.toBe(23);

    expect(commands.calls).toHaveLength(1);
    expect(error).toHaveBeenCalledWith("workmux exited with status 23.");
    expect(clipboardWriter).toHaveBeenCalledOnce();
    expect(clipboardWriter.mock.calls[0][0]).not.toContain("`workmux ");
  });

  it("reports a launch error and returns one when no exit status exists", async () => {
    const commands = new RecordingCommandRunner(
      commandResult(null, new Error("spawn workmux ENOENT")),
    );
    const launcher = new TaskLauncher(
      doctorWith(),
      commands,
      clipboardWriter,
    );

    await expect(launcher.launch(makeResolvedTask(), "/repo")).resolves.toBe(1);

    expect(error).toHaveBeenCalledWith(
      "workmux launch failed: spawn workmux ENOENT",
    );
  });

  it("prints the full manual prompt when clipboard copying fails", async () => {
    clipboardWriter.mockRejectedValueOnce(new Error("clipboard unavailable"));
    const launcher = new TaskLauncher(
      doctorWith({ Git: CheckState.Failed }),
      new RecordingCommandRunner(),
      clipboardWriter,
    );

    await expect(launcher.launch(makeResolvedTask(), "/repo")).resolves.toBe(0);

    const printedPrompt = promptPrintedBy(log);
    expect(printedPrompt).toContain("You are working on task T0045.");
    expect(printedPrompt).toContain("Stop after the approved commit");
    expect(error).toHaveBeenCalledWith(
      "Could not copy the prompt to the clipboard: clipboard unavailable",
    );
    expect(log).toHaveBeenCalledWith(
      "Open an AI agent manually and paste the prompt printed above.",
    );
  });
});
