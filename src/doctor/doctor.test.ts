import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckItem, CheckLevel, CheckState } from "./check.js";
import {
  doctorChecks,
  Doctor,
  DoctorDisplay,
} from "./doctor.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function fakeCheck(
  name: string,
  level: CheckLevel,
  state: CheckState,
  output: string,
) {
  const check = new CheckItem(name, level, name, ["--version"]);
  const runCheck = vi.spyOn(check, "run").mockImplementation(() => {
    check.state = state;
    return output;
  });
  return {
    check,
    runCheck,
  };
}

describe("doctor checks", () => {
  it("defines the initial checks in stable order", () => {
    expect(
      doctorChecks.map(({ name, level, command, commandArgs }) => ({
        name,
        level,
        command,
        args: commandArgs,
      })),
    ).toEqual([
      {
        name: "fzf",
        level: CheckLevel.Mandatory,
        command: "fzf",
        args: ["--version"],
      },
      {
        name: "Git",
        level: CheckLevel.Recommended,
        command: "git",
        args: ["--version"],
      },
      {
        name: "tmux",
        level: CheckLevel.Recommended,
        command: "tmux",
        args: ["-V"],
      },
      {
        name: "tmux passthrough",
        level: CheckLevel.Recommended,
        command: "tmux",
        args: ["show-options", "-gqv", "allow-passthrough"],
      },
      {
        name: "workmux",
        level: CheckLevel.Recommended,
        command: "workmux",
        args: ["--version"],
      },
    ]);
  });

  it("filters by level, captures output, and displays the level", () => {
    const mandatory = fakeCheck(
      "fzf",
      CheckLevel.Mandatory,
      CheckState.Passed,
      "fzf 0.60.3\n",
    );
    const recommended = fakeCheck(
      "git",
      CheckLevel.Recommended,
      CheckState.Passed,
      "git 2.50\n",
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const results = new Doctor([
      mandatory.check,
      recommended.check,
    ]).check(CheckLevel.Mandatory, DoctorDisplay.All);

    expect(mandatory.runCheck).toHaveBeenCalledOnce();
    expect(recommended.runCheck).not.toHaveBeenCalled();
    expect(results).toEqual([mandatory.check]);
    expect(results[0]).toMatchObject({
      level: CheckLevel.Mandatory,
      state: CheckState.Passed,
    });
    expect(log).toHaveBeenCalledWith(
      "PASSED [mandatory] fzf: fzf 0.60.3",
    );
  });

  it("can print failures without printing successful checks", () => {
    const passed = fakeCheck(
      "fzf",
      CheckLevel.Mandatory,
      CheckState.Passed,
      "fzf version\n",
    );
    const failed = fakeCheck(
      "Git",
      CheckLevel.Recommended,
      CheckState.Failed,
      "git failure\n",
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    new Doctor([passed.check, failed.check]).check(
      undefined,
      DoctorDisplay.Failures,
    );

    expect(log).toHaveBeenCalledExactlyOnceWith(
      "FAILED [recommended] Git: git failure",
    );
  });

  it("can print failures and warnings as issues", () => {
    const warning = fakeCheck(
      "tmux passthrough",
      CheckLevel.Recommended,
      CheckState.Warning,
      "limited guidance",
    );
    const passed = fakeCheck(
      "workmux",
      CheckLevel.Recommended,
      CheckState.Passed,
      "workmux version",
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    new Doctor([warning.check, passed.check]).check(
      CheckLevel.Recommended,
      DoctorDisplay.Issues,
    );

    expect(log).toHaveBeenCalledExactlyOnceWith(
      "WARNING [recommended] tmux passthrough: limited guidance",
    );
  });
});

describe("command execution", () => {
  let tmpDir: string | undefined;
  const originalPath = process.env.PATH;

  afterEach(() => {
    process.env.PATH = originalPath;
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  it("runs fake executables without a shell and captures stdout and stderr", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ravel-doctor-test-"));
    const executable = path.join(tmpDir, "fzf");
    fs.writeFileSync(
      executable,
      "#!/bin/sh\nprintf 'fake fzf output\\n'\nprintf 'fake warning\\n' >&2\n",
      { mode: 0o755 },
    );
    process.env.PATH = tmpDir;
    const check = new CheckItem(
      "fzf",
      CheckLevel.Mandatory,
      "fzf",
      ["--version"],
    );

    const output = check.run();

    expect(check.state).toBe(CheckState.Passed);
    expect(output).toBe("fake fzf output\nfake warning\n");
  });

  it("fails on a non-zero exit and returns its output", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ravel-doctor-test-"));
    const executable = path.join(tmpDir, "fzf");
    fs.writeFileSync(
      executable,
      "#!/bin/sh\nprintf 'broken\\n' >&2\nexit 7\n",
      { mode: 0o755 },
    );
    process.env.PATH = tmpDir;
    const check = new CheckItem(
      "fzf",
      CheckLevel.Mandatory,
      "fzf",
      ["--version"],
    );

    const output = check.run();

    expect(check.state).toBe(CheckState.Failed);
    expect(output).toBe("broken\n");
  });

  it("fails when the command is missing", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ravel-doctor-test-"));
    process.env.PATH = tmpDir;
    const check = new CheckItem(
      "fzf",
      CheckLevel.Mandatory,
      "missing-fzf",
      ["--version"],
    );

    const output = check.run();

    expect(check.state).toBe(CheckState.Failed);
    expect(output).toContain("ENOENT");
  });
});
