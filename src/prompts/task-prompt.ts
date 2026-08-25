import * as path from "node:path";
import {
  type ResolvedTask,
  TaskPickerState,
} from "../models/resolved-task.js";

export type PromptLaunchMode = "workmux" | "manual";
export type PromptLaunch = { mode: PromptLaunchMode };

/** Generates task instructions without changing task, Git, process, or clipboard state. */
export function generateTaskPrompt(
  selectedTask: ResolvedTask,
  launch: PromptLaunch,
): string | undefined {
  if (selectedTask.state === TaskPickerState.MergeReady) {
    return undefined;
  }
  if (selectedTask.state === TaskPickerState.Blocked) {
    throw new Error(
      `Cannot generate an implementation prompt for blocked task ${selectedTask.task.id}.`,
    );
  }

  const { task } = selectedTask;
  const taskPath = `ravel/tasks/${path.basename(selectedTask.previewPath)}`;
  return `You are working on task ${task.id}.

The repository-relative task file is:
${taskPath}

This task was launched in \`${launch.mode}\` mode.

Read and follow all applicable \`AGENTS.md\` instructions, the task file, and
\`ravel/docs/ravel-conventions.md\`. Follow the \`${launch.mode}\` workflow under
\`Implementation Workflow\`; it is the authority for task status, review,
approval, verification, commit, integration, and cleanup.`;
}
