---
id: T0035
title: Polish TUI event log formatting
status: done
dependencies: []
---

# Scope

- Fix inconsistent text formatting in the TUI event log for integration progress messages.
- Disambiguate the source of duplicate `"T0033 is done"` events by specifying the branch name.

# Acceptance

- Integration progress messages are consistently formatted: every message prefixed with `"T0033 integration: "` uses sentence case (first word capitalized), and the final `"integration complete"` message includes a colon to match the others.
- When a `task-status-changed` event fires with `newStatus: "done"`, the event log message includes the branch or source context (e.g., `"T0033 is done on the main branch"` or `"T0033 is done on the T0033-rebase-conflict-amend branch"`), derived from the `filePath` already present on the event.
- The project builds, passes lint, and all tests pass.

# Implementation Notes

**Issue 1 — Inconsistent formatting:**

- Integration messages originate from two places:
  - `src/commands/integrate.ts` — step messages (lines 61-176) are already capitalized. No changes needed there.
  - `src/tui/app.tsx` line 191: `addEvent(\`${taskId} integration: starting...\`)` — `"starting"` is lowercase, should be `"Starting"`.
  - `src/commands/messages.ts` line 19: `fmtIntegrationComplete()` returns `\`${taskId} integration complete\`` — missing colon. Should be `\`${taskId} integration: Complete\`` to match the pattern.
  - The CLI path at `src/ravel.ts` also uses `fmtIntegrationComplete()` — that benefits from the same fix.

**Issue 2 — Duplicate `"is done"` message:**

- `formatEvent()` in `src/tui/app.tsx` lines 31-35 formats `task-status-changed` events. When `newStatus === "done"`, it returns `\`${event.taskId} is done\``.
- The `TaskStatusChangedEvent` in `src/models/events.ts` already carries a `filePath` field (line 17).
- The watcher in `src/watcher.ts` watches both the main repo's `ravel/tasks/` and worktree task directories, so the same status change can fire twice: once from the worktree, once from the main repo after merge.
- To disambiguate, extract the branch name (or determine if the filePath is in the main repo vs a worktree) in `formatEvent()` and include it in the message.
  - Worktree paths are under `.worktrees/<taskId>/`, so the branch name can be derived from the task ID.
  - Main repo paths are not inside `.worktrees/`, so they can be labeled as `"main"`.
  - Alternative: derive the actual git branch from the filePath context. The watcher knows which worktree the path belongs to. Consider adding the branch/source info directly to the `TaskStatusChangedEvent` type in `src/models/events.ts`, or resolving it in the formatter.
- Tests in `src/tui/app.test.ts` will need updating for the new message formats.
