import { writeClipboard } from "./commands/clipboard.js";
import {
  type CommandRunner,
  SystemCommandRunner,
} from "./commands/process.js";
import { CheckLevel, CheckState, type CheckItem } from "./doctor/check.js";
import { gitCheck } from "./doctor/checks/git.js";
import { tmuxCheck } from "./doctor/checks/tmux.js";
import { workmuxCheck } from "./doctor/checks/workmux.js";
import {
  doctor as ravelDoctor,
  type Doctor,
  DoctorDisplay,
} from "./doctor/doctor.js";
import {
  type ResolvedTask,
  TaskPickerState,
} from "./models/resolved-task.js";
import { generateTaskPrompt } from "./prompts/task-prompt.js";

const WORKFLOW_TOOL_NAMES = [
  gitCheck.name,
  tmuxCheck.name,
  workmuxCheck.name,
] as const;

type ClipboardWriter = (text: string) => Promise<void>;

export interface TaskLaunch {
  launch(selectedTask: ResolvedTask, cwd: string): Promise<number>;
}

/** Delegates selected tasks without taking ownership of their repository lifecycle. */
export class TaskLauncher implements TaskLaunch {
  constructor(
    private readonly doctor: Doctor = ravelDoctor,
    private readonly commands: CommandRunner = new SystemCommandRunner(),
    private readonly clipboardWriter: ClipboardWriter = writeClipboard,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  async launch(selectedTask: ResolvedTask, cwd: string): Promise<number> {
    const checks = this.doctor.check(
      CheckLevel.Recommended,
      DoctorDisplay.Issues,
    );
    const unavailableTools = this.unavailableTools(checks);

    if (unavailableTools.length > 0) {
      console.error(
        `Unavailable workflow tools: ${unavailableTools.join(", ")}.`,
      );
      await this.runFallback(selectedTask);
      return 0;
    }

    const prompt = generateTaskPrompt(selectedTask, { mode: "workmux" });
    const args = [
      // Select workmux's create-or-open workflow.
      "add",
      // Use the task filename-derived branch as workmux's task identity.
      selectedTask.branchName,
      // Reopen an existing task worktree instead of failing on reselection.
      "--open-if-exists",
    ];
    if (prompt !== undefined) {
      // Delegate direct prompt injection to workmux's configured agent panes.
      args.push("--prompt", prompt);
    }
    const result = this.commands.run("workmux", args, {
      cwd,
      inheritStdio: true,
    });

    if (result.status === 0) {
      return 0;
    }

    // spawnSync returns null when the child cannot start or exits by signal.
    const exitStatus = result.status ?? 1;
    const detail = result.error?.message;
    console.error(
      detail
        ? `workmux launch failed: ${detail}`
        : `workmux exited with status ${String(exitStatus)}.`,
    );
    await this.runFallback(selectedTask);
    return exitStatus;
  }

  private unavailableTools(checks: readonly CheckItem[]): string[] {
    return WORKFLOW_TOOL_NAMES.filter(
      (name) =>
        !checks.some(
          (check) =>
            check.name === name && check.state === CheckState.Passed,
        ),
    );
  }

  private async runFallback(selectedTask: ResolvedTask): Promise<void> {
    if (selectedTask.state === TaskPickerState.MergeReady) {
      if (!selectedTask.worktreePath) {
        throw new Error(
          `Merge-ready task ${selectedTask.task.id} has no registered worktree.`,
        );
      }
      console.log(
        `${selectedTask.task.id} is merge-ready on branch ${selectedTask.branchName} at ${selectedTask.worktreePath}. Open that worktree manually to inspect it or resume integration.`,
      );
      return;
    }

    const prompt = generateTaskPrompt(selectedTask, {
      mode: "manual",
      notificationMode: this.env.TMUX ? "tmux" : "direct",
    });
    if (prompt === undefined) {
      throw new Error(`No manual prompt was generated for ${selectedTask.task.id}.`);
    }

    let copied = false;
    try {
      await this.clipboardWriter(prompt);
      copied = true;
    } catch (error) {
      console.error(
        `Could not copy the prompt to the clipboard: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    console.log(`Prompt for AI agent:\n\n${prompt}`);
    console.log(
      copied
        ? "Prompt copied to the clipboard. Open an AI agent manually and paste it."
        : "Open an AI agent manually and paste the prompt printed above.",
    );
  }
}
