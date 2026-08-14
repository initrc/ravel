import { CheckItem, CheckLevel, CheckState } from "../check.js";

const guidance = [
  "set -g allow-passthrough all",
  "tmux set -g allow-passthrough all",
];

export class TmuxPassthroughCheck extends CheckItem {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {
    super(
      "tmux passthrough",
      CheckLevel.Recommended,
      "tmux",
      ["show-options", "-gqv", "allow-passthrough"],
    );
  }

  override run(): string {
    if (!this.env.TMUX) {
      this.state = CheckState.NotApplicable;
      return "not applicable outside tmux";
    }

    const commandOutput = super.run();
    if (this.state === CheckState.Failed) {
      return this.addGuidance(commandOutput);
    }

    const value = commandOutput.trim();
    if (value === "all") {
      this.state = CheckState.Passed;
      return commandOutput;
    }
    if (value === "on") {
      this.state = CheckState.Warning;
      return this.addGuidance(commandOutput, "limited to visible panes");
    }

    this.state = CheckState.Failed;
    const message =
      value === ""
        ? "allow-passthrough is not configured"
        : `allow-passthrough is ${value}`;
    return this.addGuidance(commandOutput, message);
  }

  private addGuidance(commandOutput: string, message?: string): string {
    return [commandOutput.trim(), message, ...guidance]
      .filter((line) => line)
      .join("\n");
  }
}

export const tmuxPassthroughCheck = new TmuxPassthroughCheck();
