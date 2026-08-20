---
id: T0044
title: Generate the v2 task prompt
status: new
dependencies:
  - T0043
---

# Scope

- Generate workmux and manual variants of the task-specific prompt after an eligible task is selected.
- Update the lifecycle instructions so a workmux-launched agent prepares exactly one approved commit, rebases and verifies it, then delegates merge, notification, and cleanup to workmux.

# Acceptance

- The prompt names the task ID and repository-relative task file and tells the agent to follow `AGENTS.md` and the task.
- A `new` task prompt instructs the agent to set `in-progress` before implementation.
- Before approval, the prompt requires task-scoped implementation, repository verification, status `review`, a best-effort ready-for-review notification, no commit or integration, and an explicit wait for `LGTM`.
- The prompt contains the exact direct and tmux-wrapped OSC 9 `printf` commands, chooses by `$TMUX`, treats notification failure as non-blocking, and never notifies merely because a task was selected.
- After `LGTM`, both variants require status `done` and exactly one local commit named `<task-id>: <task-title>`.
- The workmux variant then requires `workmux rebase`, conflict resolution with `git rebase --continue` without another commit, and full verification of the rebased result.
- Only after verification, the workmux variant runs `workmux merge --rebase --notification`; if its rebase finds newer conflicts, the agent resolves them, reverifies, and retries.
- The workmux variant explains that the separate rebase prevents a conflict-free merge from cleaning up before the rebased result is verified.
- The workmux variant identifies the two workmux commands as narrow post-`LGTM` exceptions to the general Ravel convention against agent-owned merge and worktree deletion.
- Both variants prohibit direct push, merge, worktree removal, and branch deletion commands; the workmux variant delegates merge and cleanup only through the named workmux commands.
- The manual variant stops after the approved commit, reports the branch for user-owned integration, and contains no workmux command.
- Neither variant contains an agent command, base/main branch name, worktree path, or Ravel configuration; workmux remembers and resolves the base and merge target for its variant.
- Prompt generation does not access the clipboard; T0045 owns manual/error fallback copying.
- A derived `merge-ready` task does not generate a new implementation prompt.
- Tests cover every lifecycle step, launch-mode variant, notification variant and trigger, exact commit formatting, workmux commands, conflict recovery, new versus resumed status wording, and the absence of clipboard side effects.
- The project builds successfully, `npm run lint` passes, and `npm test` passes in full.

# Implementation Notes

- Start with the selected task returned by T0043 and the v1 prompt in Git history for reusable wording only.
- Follow prompt generation at `ravel/docs/design-v2.md:274` and the workmux lifecycle at `ravel/docs/design-v2.md:295`.
- Keep prompt generation a pure function. Clipboard writing remains behind the existing boundary but is called only by T0045 fallback paths.
- Do not add Git commands or mutate task status in Ravel; the agent performs status transitions in its checkout.
