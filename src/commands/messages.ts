// Shared message templates used by both CLI and TUI.
// When you change these, both interfaces stay consistent.

/** /assign: worktree path announcement */
export function fmtAssignWorktree(path: string) {
  return `Worktree created at ${path}`;
}

/** /assign: branch announcement */
export function fmtAssignBranch(branch: string) {
  return `Branch: ${branch}`;
}

/** /assign: launch instruction shown before the command */
export const ASSIGN_LAUNCH_INSTRUCTION = "\nRun this command in a new terminal.\n";

/** /integrate: completion announcement */
export function fmtIntegrationComplete(taskId: string) {
  return `${taskId} integration complete`;
}
