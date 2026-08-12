---
id: T0043
title: Add the fzf task picker
status: new
dependencies:
  - T0042
---

# Scope

- Discover the nearest initialized Ravel project and use Git's registered worktree metadata to resolve the primary task collection and live task status for each derived task branch.
- Add one ordinary `fzf` process with stable state grouping, searchable row formatting, resolved-file preview, selection decoding, cancellation, and blocked-task feedback.

# Acceptance

- Invocation from a primary or linked worktree root or nested directory finds the local Ravel project; missing initialization tells the user to run `ravel init`.
- When Git is available, `git worktree list --porcelain -z` identifies the primary worktree and every registered absolute worktree path without assuming workmux's default or configured `worktree_dir`.
- A task filename derives its exact branch name; a matching `branch refs/heads/<name>` record supplies the live task file, while detached and unrelated worktrees are ignored.
- Primary task status remains authoritative for dependency completion and merged `done`; matching worktree `in-progress` and `review` are displayed live, and matching worktree `done` derives the non-persisted `ready-to-merge` state.
- Without Git, Ravel falls back to the locally discovered task collection and manual prompt behavior.
- Rows repeat status, task ID, and title, exclude primary `done` tasks, and are ordered `ready-to-merge`, `review`, `in-progress`, `new`, then `blocked`.
- `fzf` receives `--no-sort`, a header explaining Enter and Escape, and searchable visible text without selectable section headers.
- The preview shows the complete matching worktree task file when present, otherwise the primary task file.
- Hidden selection metadata cannot corrupt visible fields, and preview paths are safely quoted for spaces and shell metacharacters.
- Escape or an empty selection exits successfully without changing Git, task, clipboard, or tmux state.
- Selecting a blocked task exits unsuccessfully without mutation and names every incomplete dependency.
- When there are no open tasks, Ravel prints that fact instead of spawning an empty picker.
- A matching registered worktree with no corresponding task file fails with the branch and path instead of silently using stale primary status.
- Tests drive fake Git and `fzf` executables and verify NUL-delimited porcelain parsing, custom paths, exact branch matching, status overlays, primary dependency authority, `ready-to-merge`, arguments, ordering, previews, cancellation, and blocked selection.
- The project builds successfully, `npm run lint` passes, and `npm test` passes in full.

# Implementation Notes

- Start from `src/ravel.ts:1`, the mandatory-only preflight introduced in T0042, `src/commands/git.ts:1`, and `src/models/task.ts:1`.
- Follow project discovery, worktree resolution, and picker behavior in `ravel/docs/design-v2.md`.
- Invoke external `fzf`; do not add an npm fzf UI library and do not request fzf's tmux popup mode.
- Use `git worktree list --porcelain -z`, not human-formatted Git output, `git branch` path guesses, workmux config parsing, or a constructed sibling path.
- Keep Git use read-only. Worktree creation, reopening, merge, and cleanup remain delegated to workmux in T0045.
