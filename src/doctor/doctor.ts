import { CheckLevel, CheckState, type CheckItem } from "./check.js";
import { fzfCheck } from "./checks/fzf.js";
import { gitCheck } from "./checks/git.js";
import { tmuxPassthroughCheck } from "./checks/tmux-passthrough.js";
import { tmuxCheck } from "./checks/tmux.js";
import { workmuxCheck } from "./checks/workmux.js";

export enum DoctorDisplay {
  All = "all",
  Failures = "failures",
  Issues = "issues",
}

export const doctorChecks: readonly CheckItem[] = [
  fzfCheck,
  gitCheck,
  tmuxCheck,
  tmuxPassthroughCheck,
  workmuxCheck,
];

export class Doctor {
  constructor(private readonly checks: readonly CheckItem[] = doctorChecks) {}

  check(level?: CheckLevel, display = DoctorDisplay.All): CheckItem[] {
    const results: CheckItem[] = [];

    for (const check of this.checks) {
      if (level && check.level !== level) {
        continue;
      }

      const output = check.run();
      results.push(check);

      const shouldDisplay =
        display === DoctorDisplay.All ||
        (display === DoctorDisplay.Failures &&
          check.state === CheckState.Failed) ||
        (display === DoctorDisplay.Issues &&
          (check.state === CheckState.Failed ||
            check.state === CheckState.Warning));
      if (shouldDisplay) {
        const details = output.trim();
        const summary = `${check.state} [${check.level}] ${check.name}`;
        console.log(details ? `${summary}: ${details}` : summary);
      }
    }

    return results;
  }
}

export const doctor = new Doctor();
