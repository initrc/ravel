import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckItem, CheckState } from "../check.js";
import { TmuxPassthroughCheck } from "./tmux-passthrough.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function fakeCommand(state: CheckState, output: string) {
  return vi
    .spyOn(CheckItem.prototype, "run")
    .mockImplementation(function (this: CheckItem) {
      this.state = state;
      return output;
    });
}

describe("TmuxPassthroughCheck", () => {
  it("is not applicable and does not execute outside tmux", () => {
    const runCommand = fakeCommand(CheckState.Passed, "all\n");
    const check = new TmuxPassthroughCheck({});

    const output = check.run();

    expect(runCommand).not.toHaveBeenCalled();
    expect(check.state).toBe(CheckState.NotApplicable);
    expect(output).toBe("not applicable outside tmux");
  });

  it("passes when passthrough is all", () => {
    fakeCommand(CheckState.Passed, "all\n");
    const check = new TmuxPassthroughCheck({ TMUX: "inside" });

    expect(check.run()).toBe("all\n");
    expect(check.state).toBe(CheckState.Passed);
  });

  it("warns that on is limited to visible panes and provides guidance", () => {
    fakeCommand(CheckState.Passed, "on\n");
    const check = new TmuxPassthroughCheck({ TMUX: "inside" });

    const output = check.run();

    expect(check.state).toBe(CheckState.Warning);
    expect(output).toContain("limited to visible panes");
    expect(output).toContain("set -g allow-passthrough all");
    expect(output).toContain("tmux set -g allow-passthrough all");
  });

  it.each(["off\n", ""])(
    "fails disabled passthrough value %j and provides guidance",
    (value) => {
      fakeCommand(CheckState.Passed, value);
      const check = new TmuxPassthroughCheck({ TMUX: "inside" });

      const output = check.run();

      expect(check.state).toBe(CheckState.Failed);
      expect(output).toContain("set -g allow-passthrough all");
      expect(output).toContain("tmux set -g allow-passthrough all");
    },
  );

  it("preserves command failure output", () => {
    fakeCommand(CheckState.Failed, "tmux server error\n");
    const check = new TmuxPassthroughCheck({ TMUX: "inside" });

    const output = check.run();

    expect(check.state).toBe(CheckState.Failed);
    expect(output).toContain("tmux server error");
  });
});
