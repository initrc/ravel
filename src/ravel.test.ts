import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import { CheckItem, CheckLevel, CheckState } from "./doctor/check.js";
import { Doctor, DoctorDisplay } from "./doctor/doctor.js";
import { type CommandResult, type CommandRunner } from "./commands/process.js";
import { ResolvedTask, TaskPickerState } from "./models/resolved-task.js";
import { TaskPicker } from "./task-picker.js";
import { runCli } from "./ravel.js";

class PickerCommandRunner implements CommandRunner {
  constructor(
    private readonly gitResult: CommandResult,
    private readonly fzfResult: CommandResult,
  ) {}

  run(command: string): CommandResult {
    return command === "git" ? this.gitResult : this.fzfResult;
  }
}

function writeTask(
  root: string,
  filename: string,
  status: string,
  dependencies: string[] = [],
): string {
  const taskPath = path.join(root, "ravel", "tasks", filename);
  fs.mkdirSync(path.dirname(taskPath), { recursive: true });
  const id = filename.slice(0, filename.indexOf("-"));
  const title = filename.slice(filename.indexOf("-") + 1, -3);
  const content = [
    "---",
    `id: ${id}`,
    `title: ${title}`,
    `status: ${status}`,
    `dependencies: ${JSON.stringify(dependencies)}`,
    "---",
    "Task body",
    "",
  ].join("\n");
  fs.writeFileSync(taskPath, content);
  return taskPath;
}

function fakeCheck(
  name: string,
  level: CheckLevel,
  state: CheckState,
  output: string,
): CheckItem {
  const check = new CheckItem(name, level, name, ["--version"]);
  vi.spyOn(check, "run").mockImplementation(() => {
    check.state = state;
    return output;
  });
  return check;
}

describe("runCli", () => {
  let tmpDir: string;
  let projectDir: string;
  let templatesDir: string;
  let log: Mock<typeof console.log>;
  let error: Mock<typeof console.error>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ravel-cli-test-"));
    projectDir = path.join(tmpDir, "project");
    templatesDir = path.join(tmpDir, "templates");
    fs.mkdirSync(projectDir);
    fs.mkdirSync(templatesDir);
    fs.writeFileSync(
      path.join(templatesDir, "AGENTS.md"),
      "# AGENTS.md\n\n## Ravel Conventions\n\nTest instructions.\n",
    );
    fs.writeFileSync(
      path.join(templatesDir, "ravel-conventions.md"),
      "# Ravel Conventions\n",
    );
    log = vi.fn<typeof console.log>();
    error = vi.fn<typeof console.error>();
    vi.spyOn(console, "log").mockImplementation(log);
    vi.spyOn(console, "error").mockImplementation(error);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("prints help for --help", async () => {
    await expect(runCli(["--help"], projectDir, templatesDir)).resolves.toBe(0);

    const output = String(log.mock.calls[0]?.[0]);
    expect(output).toContain("Usage: ravel [init|doctor|--help|--version]");
    expect(output).toContain("init");
    expect(output).toContain("doctor");
    expect(output).not.toContain("assign");
    expect(output).not.toContain("integrate");
  });

  it("prints the package version for --version", async () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(import.meta.dirname, "..", "package.json"), "utf-8"),
    ) as { version: string };

    await expect(runCli(["--version"], projectDir, templatesDir)).resolves.toBe(
      0,
    );
    expect(log).toHaveBeenCalledWith(packageJson.version);
  });

  it("routes init with the current directory and injected templates", async () => {
    await expect(runCli(["init"], projectDir, templatesDir)).resolves.toBe(0);

    expect(
      fs.existsSync(path.join(projectDir, "ravel", "docs", "ravel-conventions.md")),
    ).toBe(true);
  });

  it("runs the task picker after the mandatory preflight", async () => {
    const doctor = new Doctor([
      fakeCheck("fzf", CheckLevel.Mandatory, CheckState.Passed, "fzf 0.60.3\n"),
    ]);
    const checkDoctor = vi.spyOn(doctor, "check");
    const picker = new TaskPicker(
      new PickerCommandRunner(
        { status: 1, stdout: "", stderr: "" },
        { status: 130, stdout: "", stderr: "" },
      ),
    );
    const pick = vi.spyOn(picker, "pick").mockReturnValue(undefined);

    await expect(
      runCli([], projectDir, templatesDir, doctor, picker),
    ).resolves.toBe(0);
    expect(checkDoctor).toHaveBeenCalledWith(
      CheckLevel.Mandatory,
      DoctorDisplay.Failures,
    );
    expect(pick).toHaveBeenCalledWith(projectDir);
  });

  it("returns the selected task launch status", async () => {
    const doctor = new Doctor([
      fakeCheck("fzf", CheckLevel.Mandatory, CheckState.Passed, "fzf 0.60.3\n"),
    ]);
    const picker = new TaskPicker(
      new PickerCommandRunner(
        { status: 1, stdout: "", stderr: "" },
        { status: 130, stdout: "", stderr: "" },
      ),
    );
    const task = {
      id: "T0045",
      title: "Delegate launching to workmux",
      status: "new" as const,
      dependencies: ["T0044"],
      filename: "T0045-delegate-launching-to-workmux.md",
      filePath: path.join(
        projectDir,
        "ravel/tasks/T0045-delegate-launching-to-workmux.md",
      ),
    };
    const selectedTask = new ResolvedTask(
      task,
      "T0045-delegate-launching-to-workmux",
      TaskPickerState.New,
      task.filePath,
      [],
    );
    vi.spyOn(picker, "pick").mockReturnValue(selectedTask);
    const launch = vi.fn().mockResolvedValue(23);

    await expect(
      runCli([], projectDir, templatesDir, doctor, picker, { launch }),
    ).resolves.toBe(23);

    expect(launch).toHaveBeenCalledWith(selectedTask, projectDir);
  });

  it("stops bare ravel when its mandatory preflight fails", async () => {
    const doctor = new Doctor([
      fakeCheck("fzf", CheckLevel.Mandatory, CheckState.Failed, "fzf not found"),
    ]);

    await expect(runCli([], projectDir, templatesDir, doctor)).resolves.toBe(1);
    expect(log).toHaveBeenCalledWith(
      "FAILED [mandatory] fzf: fzf not found",
    );
  });

  it("fails without mutation when a blocked task is selected", async () => {
    fs.mkdirSync(path.join(projectDir, "ravel", "tasks"), { recursive: true });
    writeTask(projectDir, "T0001-first.md", "new");
    const blockedPath = writeTask(
      projectDir,
      "T0002-second.md",
      "new",
      ["T0001"],
    );
    const before = fs.readFileSync(blockedPath, "utf-8");
    const doctor = new Doctor([
      fakeCheck("fzf", CheckLevel.Mandatory, CheckState.Passed, "fzf 0.60.3\n"),
    ]);
    const picker = new TaskPicker(
      new PickerCommandRunner(
        { status: 1, stdout: "", stderr: "" },
        { status: 0, stdout: "1\tcorrupted visible fields\n", stderr: "" },
      ),
    );

    await expect(
      runCli([], projectDir, templatesDir, doctor, picker),
    ).resolves.toBe(1);
    expect(error).toHaveBeenCalledWith(
      "T0002 is blocked by incomplete dependencies: T0001 (first)",
    );
    expect(fs.readFileSync(blockedPath, "utf-8")).toBe(before);
  });

  it("tells the user to initialize when no project is discoverable", async () => {
    const doctor = new Doctor([
      fakeCheck("fzf", CheckLevel.Mandatory, CheckState.Passed, "fzf 0.60.3\n"),
    ]);
    const picker = new TaskPicker(
      new PickerCommandRunner(
        { status: 1, stdout: "", stderr: "" },
        { status: 0, stdout: "", stderr: "" },
      ),
    );

    await expect(
      runCli([], projectDir, templatesDir, doctor, picker),
    ).resolves.toBe(1);
    expect(error).toHaveBeenCalledWith(
      "Ravel is not initialized here. Run `ravel init`.",
    );
  });

  it("runs all doctor checks and succeeds with recommended failures", async () => {
    const doctor = new Doctor([
      fakeCheck("fzf", CheckLevel.Mandatory, CheckState.Passed, "fzf 0.60.3\n"),
      fakeCheck(
        "workmux",
        CheckLevel.Recommended,
        CheckState.Failed,
        "workmux not found",
      ),
    ]);
    const checkDoctor = vi.spyOn(doctor, "check");

    await expect(
      runCli(["doctor"], projectDir, templatesDir, doctor),
    ).resolves.toBe(0);
    expect(checkDoctor).toHaveBeenCalledWith(
      undefined,
      DoctorDisplay.All,
    );
  });

  it("exits one from doctor when a mandatory check fails", async () => {
    const doctor = new Doctor([
      fakeCheck("fzf", CheckLevel.Mandatory, CheckState.Failed, "fzf not found"),
    ]);

    await expect(
      runCli(["doctor"], projectDir, templatesDir, doctor),
    ).resolves.toBe(1);
  });

  it.each([["assign"], ["--unknown"], ["init", "extra"], ["--help", "extra"]])(
    "rejects unsupported arguments: %s",
    async (...args) => {
      await expect(runCli(args, projectDir, templatesDir)).resolves.toBe(1);
      expect(error).toHaveBeenCalledWith(
        "Usage: ravel [init|doctor|--help|--version]",
      );
    },
  );
});
