---
id: T0048
title: Fix fzf task filtering
status: new
dependencies: []
---

# Scope

- Restore interactive keyword filtering in the fzf task picker without changing task ordering, display, preview, or selection behavior.
- Add regression coverage for the fzf field options that caused filtering to be disabled.

# Acceptance

- Typing a query filters tasks by their visible state, task ID, and title, and removes nonmatching rows from the displayed candidates.
- Ravel continues to hide the numeric selection key and does not include that hidden key in matching.
- Accepting a filtered task still returns the original row containing the numeric key so Ravel selects the correct resolved task.
- `--no-sort` continues to preserve the merge-ready, review-ready, in-progress, new, and blocked grouping among matching tasks.
- The picker uses the `--with-nth=2..` presentation transform without also applying the conflicting `--nth=2..` search scope.
- Tests assert the exact field-option contract and retain coverage for safe selection parsing, preview behavior, cancellation, and task ordering.
- No task, Git, clipboard, tmux, workmux, or project state is mutated merely by filtering or cancelling the picker.
- The project builds successfully, `npm run lint` passes, and `npm test` passes in full.

# Implementation Notes

- Start with the fzf arguments in `src/task-picker.ts:80` and their assertions in `src/task-picker.test.ts:150`.
- T0043 introduced rows shaped as `<hidden-index>\t<visible-task>`. With fzf 0.74.2, `--with-nth=2..` already excludes the transformed-away key from interactive matching; combining it with `--nth=2..` applies the search scope after transformation and points past the remaining field.
- Keep `--with-nth=2..` so display and accepted-output behavior remain unchanged, and remove only the redundant search-scope option and its stale comments or assertions.
- An optional local reproduction can pipe representative rows to fzf with `--query`, `--select-1`, and `--exit-0`; automated tests must not require a real interactive terminal or developer-installed fzf.
