---
id: T0019
title: Backfill tests for untested source files under src/
status: done
dependencies: []
---

# Scope

Audit `src/` and its subdirectories for source files that lack corresponding test files, then write tests for files where testing adds meaningful coverage.

## Files without tests

- `src/ravel.ts` — CLI entrypoint (program commands)
- `src/tui/app.tsx` — TUI App component (state management, command handling, watcher integration)
- `src/tui/components/CommandInput.tsx` — Command input with useInput hook
- `src/tui/components/Column.tsx` — Single column display
- `src/tui/components/Dashboard.tsx` — Dashboard layout wrapper
- `src/tui/components/EventLog.tsx` — Event log display
- `src/tui/components/TaskColumns.tsx` — Four-column task layout
- `src/commands/git.ts` — Git helper utilities
- `src/commands/integrate.ts` — Integration flow
- `src/commands/notify.ts` — macOS notification helper
- `src/models/session.ts` — Session file model
- `src/models/events.ts` — Event types

## Approach

- Files that are mostly declarative/glue (ravel.ts, Dashboard.tsx) or trivial wrappers (Column.tsx, EventLog.tsx, events.ts, notify.ts): skip or write minimal tests.
- Files with logic worth covering: app.tsx (command handling, state transitions), CommandInput.tsx (input behavior), TaskColumns.tsx (task filtering), git.ts (git operations), integrate.ts (integration flow), session.ts (serialization/deserialization).
- Prioritize business logic over rendering tests for Ink components. For Ink components, test the logic extracted from the component (pure functions) where possible.

# Acceptance

- At least `git.ts`, `integrate.ts`, `session.ts`, `app.tsx`, and `CommandInput.tsx` have test files.
- `npm test` passes.
- Tests focus on logic, not Ink rendering internals.

# Implementation Notes

- Existing tests use vitest with `describe`/`it` blocks and live in `src/**/*.test.ts`.
- `git.ts` has functions like `branchFromFilename`, `taskIdFromBranch` — these are pure and easy to test.
- `session.ts` reads/writes JSON session files — test with tmp directories.
- `integrate.ts` is the most complex untested file — tested with mocked git, config, session, and task modules rather than a real git repo. Rationale: the integration flow has 10+ git operations with error handling branches (conflict vs non-conflict rebase errors, stash-pop failure, worktree-remove failure) that are impractical or impossible to trigger reliably with real git. Mocks make every code path reachable and keep the tests focused on orchestration logic (which events fire, which errors are fatal, whether cleanup proceeds). The polling-for-commit test uses `vi.advanceTimersByTimeAsync` to avoid real `setTimeout` waits, cutting test time from ~500ms to ~7ms.
- For `app.tsx`, extract command parsing/handling logic into testable pure functions.
- `CommandInput.tsx` input handling logic can be tested by extracting the keypress handler.
