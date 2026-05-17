---
id: T0027
title: Fix /integrate re-trigger in TUI
status: done
dependencies: []
---

# Scope

- When `/integrate <taskId>` is typed in the TUI, it should always start integration regardless of whether the task was previously integrated (successfully or not).
- The `integratedRef` set in `app.tsx` prevents re-triggering even when the prior integration attempt failed (e.g., timed out). An explicit user command should override this guard.

# Acceptance

- After an auto-triggered integration times out, typing `/integrate <taskId>` in the TUI successfully starts a new integration attempt.
- After a successful integration, the task remains in the integrated set — there is nothing to re-integrate (worktree and branch are gone).
- `npm test` passes.

# Implementation Notes

- The guard is at `src/tui/app.tsx:175`: `if (integratedRef.current.has(taskId)) return;`.
- The `integrateTask` function is called from two places:
  1. Auto-trigger from watcher event (line 247): should still be guarded against double-fire.
  2. Manual `/integrate` command handler (line 330): works because the guard is cleared on failure.
- Simplest fix: remove from `integratedRef` on failure in the error handlers (the `.catch` on line 220).
- Edge case: a running integration should still serialize — the `integratingRef` guard on line 179 is still correct regardless of manual vs auto trigger.
