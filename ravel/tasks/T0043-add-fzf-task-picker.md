---
id: T0043
title: Add the fzf task picker
status: new
dependencies:
  - T0042
---

# Scope

- Add one ordinary `fzf` process that lists all tasks not committed as `done` on `baseBranch` and returns a selected task to the bare-command workflow.
- Implement stable state grouping, searchable row formatting, full-file preview, selection decoding, cancellation, and blocked-task feedback.

# Acceptance

- Rows repeat status, task ID, and title and are ordered `merging`, `review`, `in-progress`, `new`, then `blocked`.
- `fzf` receives `--no-sort`, a header explaining Enter and Escape, and searchable visible text without selectable section headers.
- The preview shows the complete applicable task file: the active worktree copy when present, otherwise the primary-checkout copy.
- Hidden selection metadata cannot corrupt visible fields, and preview paths are safely quoted for spaces and shell metacharacters.
- Escape or an empty selection exits successfully without changing Git, task, clipboard, or tmux state.
- Selecting a blocked task exits without mutation and names every incomplete dependency.
- When there are no open tasks, Ravel prints that fact instead of spawning an empty picker.
- Tests drive a fake `fzf` executable and verify arguments, input ordering, selected records, previews, cancellation, and blocked selection without requiring an interactive terminal.
- The project builds successfully, `npm run lint` passes, and `npm test` passes in full.

# Implementation Notes

- Start from the bare-command handoff introduced in T0041 and the resolved task view from T0042.
- Follow the interface contract in `ravel/docs/design-v2.md:327` and the picker test cases in `ravel/docs/design-v2.md:604`.
- Invoke external `fzf`; do not add an npm fzf UI library and do not request fzf's tmux popup mode.
- Keep the adapter limited to formatting records, spawning fzf, and decoding its result. Worktree mutation belongs to T0044 and process launching belongs to T0045.
