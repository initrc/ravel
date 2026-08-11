---
id: T0044
title: Implement the v2 worktree lifecycle
status: new
dependencies:
  - T0042
---

# Scope

- Implement Git-backed validation, creation, recovery, and resume behavior for the task selected by the v2 workflow.
- Create new task branches and worktrees from configured `baseBranch`, update only the worktree task to `in-progress`, and return the correct existing worktree for active tasks.

# Acceptance

- Before mutation, Ravel rejects a blocked task, a missing `baseBranch`, an untracked or base-divergent task file, and conflicting or ambiguous branch, registration, or filesystem state.
- A new task uses one `git worktree add -b <task-branch> .worktrees/<task-id> <baseBranch>` operation and changes only its worktree task copy to `in-progress`.
- The task branch derives from the filename and the primary-checkout task file remains unchanged.
- An active registered worktree is reused at its registered path; an existing task branch with no worktree is reattached at the canonical path.
- A task branch registered at a noncanonical path uses that path, while an unregistered canonical directory and any ambiguous mapping fail with actionable recovery guidance.
- Failed new-task setup rolls back only the branch and worktree created by that attempt. Pre-existing branches, worktrees, directories, and user changes are never removed or overwritten.
- No path creates runtime session files, force-removes a worktree, force-deletes a branch, stashes changes, fetches, merges, or cleans up completed task state.
- Tests cover launch validation, new creation, registered reuse, branch reattachment, unsafe state, and partial-failure rollback in temporary Git repositories.
- The project builds successfully, `npm run lint` passes, and `npm test` passes in full.

# Implementation Notes

- Start with the Git execution helper retained by T0040 and the task-state model introduced in T0042. Add only the branch and worktree operations required by this workflow.
- Follow `ravel/docs/design-v2.md:305` for discovery safety, `ravel/docs/design-v2.md:367` for new-task mutation, and `ravel/docs/design-v2.md:617` for lifecycle tests.
- Use the state model from T0042 for both picker display and launch validation so the two paths cannot disagree about dependency or integration state.
- Rollback bookkeeping must record which resources this invocation actually created. If non-force rollback cannot safely remove them, preserve the state and report exact recovery steps rather than escalating to force.
- This task returns a worktree and whether the task is new or resumed; clipboard and terminal/tmux behavior remain in T0045.
