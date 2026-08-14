import { spawnSync } from "node:child_process";

export enum CheckLevel {
  Mandatory = "mandatory",
  Recommended = "recommended",
}

export enum CheckState {
  NotRun = "NOT RUN",
  Passed = "PASSED",
  Failed = "FAILED",
  Warning = "WARNING",
  NotApplicable = "NOT APPLICABLE",
}

export class CheckItem {
  state = CheckState.NotRun;

  constructor(
    readonly name: string,
    readonly level: CheckLevel,
    readonly command: string,
    readonly commandArgs: readonly string[],
  ) {}

  run(): string {
    const result = spawnSync(this.command, this.commandArgs, {
      encoding: "utf8",
      shell: false,
    });
    this.state = result.status === 0 ? CheckState.Passed : CheckState.Failed;
    return (
      (result.stdout ?? "") +
      (result.stderr ?? "") +
      (result.error?.message ?? "")
    );
  }

  isMandatoryFailure(): boolean {
    return (
      this.level === CheckLevel.Mandatory && this.state === CheckState.Failed
    );
  }
}
