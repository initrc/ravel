import * as path from "node:path";
import {
  type ResolvedTask,
  TaskPickerState,
} from "../models/resolved-task.js";

export type PromptLaunchMode = "workmux" | "manual";
export type PromptNotificationMode = "direct" | "tmux";
export type PromptLaunch =
  | { mode: "workmux" }
  | { mode: "manual"; notificationMode: PromptNotificationMode };

const DIRECT_NOTIFICATION =
  "printf '\\033]9;Ravel: TASK_ID ready for review\\007'";
const TMUX_NOTIFICATION =
  "printf '\\033Ptmux;\\033\\033]9;Ravel: TASK_ID ready for review\\007\\033\\\\'";

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
  const startingStatusInstruction =
    selectedTask.state === TaskPickerState.New
      ? "\nBefore implementation, update the task status from `new` to `in-progress`.\n"
      : "";
  const notificationCommand = (
    launch.mode === "workmux" || launch.notificationMode === "tmux"
      ? TMUX_NOTIFICATION
      : DIRECT_NOTIFICATION
  ).replace("TASK_ID", task.id);

  const sharedInstructions = `You are working on task ${task.id}.

The repository-relative task file is:
${taskPath}

Follow all applicable \`AGENTS.md\` instructions and the task file.
${startingStatusInstruction}
Before approval:
1. Implement only the scope of ${task.id}.
2. Run all verification required by the task and repository instructions.
3. When the implementation is ready for human review, update the task status to \`review\`.
4. Send the best-effort ready-for-review notification by running exactly:

   \`\`\`sh
   ${notificationCommand}
   \`\`\`

5. Do not commit or perform integration or cleanup. Do not push, rebase, merge, remove worktrees, or delete branches.
6. Stop and explicitly wait for the user to say \`LGTM\`.

Notification failure is non-blocking: still report that the task is ready for review and wait for \`LGTM\`. Do not send this notification merely because the task was selected; send it only after verification succeeds and the status is \`review\`.`;

  const approvedInstructions = launch.mode === "workmux"
    ? workmuxApprovedInstructions(task.id, task.title)
    : manualApprovedInstructions(task.id, task.title);

  return `${sharedInstructions}

${approvedInstructions}`;
}

function workmuxApprovedInstructions(taskId: string, taskTitle: string): string {
  return `After the user explicitly says \`LGTM\`:
1. Update the task status to \`done\`.
2. Create exactly one local commit containing the approved task changes, using this exact commit message:

   \`\`\`txt
   ${taskId}: ${taskTitle}
   \`\`\`

3. Run \`workmux rebase\`. It remembers and resolves the task's base; do not supply a branch name.
4. If that rebase conflicts, resolve the conflicts, stage the resolutions, and run \`git rebase --continue\`. Do not create another commit.
5. Run the full verification required by the task and repository instructions against the rebased result.
6. Only after that verification succeeds, run \`workmux merge --rebase --notification\`. It resolves the merge target and delegates the merge, notification, and configured cleanup to workmux.
7. If the merge-time rebase finds newer conflicts, resolve them, stage the resolutions, run \`git rebase --continue\`, rerun the full verification, and retry \`workmux merge --rebase --notification\`.

The separate \`workmux rebase\` is required because a conflict-free \`workmux merge --rebase --notification\` could otherwise integrate and clean up the worktree before the rebased result is verified.

The commands \`workmux rebase\` and \`workmux merge --rebase --notification\` are narrow, task-specific exceptions to the general Ravel convention against agent-owned merge and worktree deletion, and are authorized only after explicit \`LGTM\`. Do not run direct push, merge, rebase, worktree-removal, or branch-deletion commands, including \`git push\`, \`git merge\`, \`git rebase\`, \`git worktree remove\`, or \`git branch -d\`. The conflict-recovery command \`git rebase --continue\` is the only permitted direct Git rebase command.`;
}

function manualApprovedInstructions(taskId: string, taskTitle: string): string {
  return `After the user explicitly says \`LGTM\`:
1. Update the task status to \`done\`.
2. Create exactly one local commit containing the approved task changes, using this exact commit message:

   \`\`\`txt
   ${taskId}: ${taskTitle}
   \`\`\`

3. Stop after the approved commit and report the current branch name to the user for user-owned integration and cleanup.

Do not run direct push, rebase, merge, worktree-removal, or branch-deletion commands, including \`git push\`, \`git rebase\`, \`git merge\`, \`git worktree remove\`, or \`git branch -d\`.`;
}
