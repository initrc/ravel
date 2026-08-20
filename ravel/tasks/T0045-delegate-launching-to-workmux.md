---
id: T0045
title: Delegate launching to workmux
status: done
dependencies:
  - T0044
---

# Scope

- Delegate selected-task creation or reopening to workmux when the recommended Git, tmux, and workmux checks pass.
- Add the manual prompt fallback used when any recommended workflow tool is unavailable.

# Acceptance

- The task branch name is the selected task filename without `.md`.
- Ravel reuses the T0042 check modules to probe Git, tmux, and workmux after selection.
- A limited or failed tmux passthrough check prints notification guidance but does not block workmux launch.
- When the Git, tmux, and workmux availability checks pass, Ravel executes `workmux add <task-branch> --open-if-exists --prompt <workmux-prompt>` as an argument array without a shell and inherits its standard streams.
- The successful workmux path does not copy the prompt: workmux injects it directly into panes matching the configured agent command.
- Selecting derived `merge-ready` executes `workmux add <task-branch> --open-if-exists` without a prompt so the existing worktree can be inspected or its interrupted integration resumed.
- Ravel passes no agent command, base or main branch, worktree directory, pane layout, hooks, file operations, merge strategy, or cleanup option.
- Ravel preserves workmux's exit status; on failure it reports the result, generates and copies the manual prompt variant when agent work remains, and performs no repair or cleanup.
- When any availability check fails, Ravel does not invoke workmux, names the unavailable tools, generates, copies, and prints the full manual prompt, and explains that the user can open an agent manually and paste it.
- The manual prompt stops after the approved commit and leaves rebase, merge, and cleanup to the user; it never tells an agent without workmux to run workmux commands.
- A `merge-ready` fallback prints its branch and registered worktree path without generating or copying a new implementation prompt.
- No path creates `.ravel/`, runs a mutating Git worktree command, creates tmux windows directly, starts an agent directly, mutates task status, merges, pushes, stashes, or cleans up.
- Tests use fake executables and clipboard boundaries and cover new and existing workmux delegation, prompt-variant selection, direct prompt injection without clipboard writes, `merge-ready` reopening, safe argument passing, inherited output and exit status, every fallback, and copy failure.
- The project builds successfully, `npm run lint` passes, and `npm test` passes in full.

# Implementation Notes

- Start with `src/ravel.ts:1`, the check results from T0042, the picker result from T0043, and the prompt from T0044.
- Follow workmux delegation at `ravel/docs/design-v2.md:362` and manual fallback at `ravel/docs/design-v2.md:412`.
- Workmux documents prompt injection and idempotent `add --open-if-exists`; use the worktree path already resolved by T0043 only for user feedback, not for lifecycle operations.
- Keep workmux execution injectable. Recommended checks run after selection so the mandatory-only startup preflight remains fast.
