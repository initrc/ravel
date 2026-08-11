---
id: T0045
title: Launch interactive agent sessions
status: new
dependencies:
  - T0043
  - T0044
---

# Scope

- Connect picker selection and worktree resolution to prompt generation, clipboard copy, tmux window creation or resume, direct-terminal launching, and copy-only behavior.
- Implement an agent prompt that enforces the v2 review gate, conservative post-approval integration, failure handling, and manual cleanup workflow.

# Acceptance

- Starting a new task writes `in-progress`, copies its prompt without a second question, and launches in the resolved worktree.
- The prompt includes the task ID and file, task branch and worktree context, absolute primary root, configured `baseBranch`, pre-review instructions, the explicit `LGTM` gate, exact one-commit format, local rebase and fast-forward preconditions, verification after rebase, failure behavior, prohibited actions, and safe manual cleanup commands.
- Inside tmux, Ravel creates a current-session window named for the task ID at the worktree path, disables automatic rename, and tags it with `@ravel_project_root` and `@ravel_task_id`.
- Resuming finds a window only when both tags match, selects it without replacing the clipboard, and never switches tmux sessions; a missing matching window recopies the prompt and creates one.
- Outside tmux, a configured agent command runs interactively with inherited standard streams and the worktree as `cwd`, and Ravel waits for it to exit.
- Copy-only mode uses a shell window inside tmux; outside tmux it prints the full prompt, confirms the copy, and prints an exactly quoted `cd` command without claiming to change the parent shell directory.
- Agent commands may contain arguments and are treated as trusted local configuration without interpolating untrusted task text into executable shell syntax.
- Ravel never performs the agent's rebase, verification, merge, push, stash, or cleanup steps itself.
- Tests use fake tmux, agent, and clipboard boundaries and cover new launch plus every resume and copy-only branch.
- The project builds successfully, `npm run lint` passes, and `npm test` passes in full.

# Implementation Notes

- Start with `src/ravel.ts:1`, the raw clipboard boundary retained by T0040, and the picker/worktree results from T0043 and T0044. Use `src/commands/prompt.ts:1` as the focused destination if prompt code was removed during cleanup.
- Follow resume semantics in `ravel/docs/design-v2.md:393`, tmux behavior in `ravel/docs/design-v2.md:414`, non-tmux behavior in `ravel/docs/design-v2.md:443`, and the review flow in `ravel/docs/design-v2.md:457`.
- Keep process spawning behind small injectable boundaries so tests do not need a tmux server, real clipboard, or installed agent.
- Do not revive launch-command clipboard preferences or any other v1 configuration field. `agentCommand: null` is the sole copy-only setting.
