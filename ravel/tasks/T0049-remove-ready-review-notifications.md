---
id: T0049
title: Remove ready-for-review notification logic
status: done
dependencies: []
---

# Scope

- Remove Ravel's ready-for-review notification instructions, including the
  direct and tmux-wrapped OSC 9 `printf` commands and notification-mode
  selection.
- Remove the tmux `allow-passthrough` doctor check and its configuration
  guidance because Ravel will no longer emit terminal escape-sequence
  notifications.
- Preserve the post-approval
  `workmux merge --rebase --notification` instruction. Workmux owns this native
  successful-merge notification along with the merge and configured cleanup.
- Do not add or configure workmux agent-status hooks. Codex's existing
  turn-ended macOS notification is sufficient when the agent reports that the
  task is ready for review and stops to wait for `LGTM`.
- Update user-facing documentation, design documentation, and the pending T0047
  end-to-end task so they describe and verify the final notification boundary.

# Acceptance

- Generated workmux and manual prompts contain no OSC 9 sequence, tmux DCS
  passthrough wrapper, notification `printf`, ready-for-review notification
  step, or non-blocking notification-failure text.
- Prompt generation and manual fallback no longer select behavior from `$TMUX`
  solely for notifications.
- `ravel doctor` no longer reads, validates, or recommends
  `allow-passthrough`, while the Git, tmux, and workmux availability checks used
  by the supported workflow remain intact.
- The workmux post-`LGTM` lifecycle still requires
  `workmux merge --rebase --notification`, including the existing conflict
  recovery and verification requirements. The manual lifecycle still contains
  no workmux command.
- Ravel does not install, configure, or require workmux status hooks or tmux
  status icons.
- README and v2 design documentation no longer promise a Ravel-owned
  ready-for-review system notification or recommend tmux passthrough. They
  distinguish the retained workmux native successful-merge notification from
  agent-owned turn-completion notifications.
- T0047 no longer requires coverage for OSC notification variants or tmux
  passthrough, and continues to cover the retained workmux merge notification
  command.
- The project builds, passes lint, and all tests pass.

# Implementation Notes

- Start with `src/prompts/task-prompt.ts`, where `DIRECT_NOTIFICATION` and
  `TMUX_NOTIFICATION` define the OSC commands and `generateTaskPrompt` inserts
  the selected command into the review gate.
- Simplify the launch types and the fallback call in `src/task-launcher.ts` only
  as far as required after notification-mode selection is removed. Preserve
  workmux prompt injection and manual clipboard fallback behavior.
- Remove the passthrough check from `src/doctor/checks/tmux-passthrough.ts` and
  its doctor registration, exports, tests, and documentation. Do not weaken the
  ordinary tmux availability check required for workmux launching.
- Update focused prompt, launcher, doctor, and process-boundary tests rather
  than replacing the removed notification behavior with another Ravel-owned
  notifier.
- Reconcile `ravel/docs/design-v2.md`, `README.md`, and
  `ravel/tasks/T0047-verify-v2-end-to-end.md` with this decision. Earlier
  notification requirements originated in T0042, T0044, and T0046; those done
  tasks remain historical records and do not need rewriting.
- Investigation showed that the Codex shell tool's stdout is not a TTY, so OSC
  bytes printed by a tool command are captured as tool output and may never
  reach the tmux pane. The Codex sandbox also denied access to the tmux socket,
  even though the live server correctly had `allow-passthrough` set to `all`.
  This makes the Ravel OSC mechanism structurally unreliable rather than a
  missing tmux setting.
- Workmux 0.1.240 implements `merge --notification` separately: after a
  successful merge and before cleanup, it uses a native macOS notification
  library (or `notify-rust` on other platforms). It does not depend on OSC or
  tmux passthrough, and notification failure is non-blocking.
- Workmux status hooks are a separate optional feature that maps agent lifecycle
  events to tmux status values. They are intentionally out of scope. For the
  agreed Codex workflow, stopping after the ready-for-review response ends the
  Codex turn and uses Codex's existing macOS turn-ended notification.
