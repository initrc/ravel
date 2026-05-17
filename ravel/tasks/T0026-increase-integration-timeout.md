---
id: T0026
title: Increase integration timeout to 300s
status: new
dependencies: []
---

# Scope

- Increase the polling timeout in `runIntegration` from 15 seconds to 300 seconds when waiting for the agent to finish committing and rebasing on the feature branch.
- Increase the polling interval from 500ms to 2000ms. The agent's work (committing, rebasing with conflict resolution) takes tens of seconds, so a 2-second poll is responsive enough while reducing churn.
- Implement the `todo` test case "throws after timeout when worktree never becomes clean" in `integrate.test.ts`.

# Acceptance

- `timeoutMs` is 300_000 and `intervalMs` is 2000 in `src/commands/integrate.ts`.
- The new timeout is reflected in the error message (300s instead of 15s).
- The todo test at `integrate.test.ts:488` is implemented and passes.

# Implementation Notes

- The timeout value is at `src/commands/integrate.ts:66`: `const timeoutMs = 15_000` → `300_000`.
- The interval value is at `src/commands/integrate.ts:67`: `const intervalMs = 500` → `2000`.
- The error message on line 73 uses `${timeoutMs / 1000}s` so it self-adjusts.
- The test uses `vi.useFakeTimers()` and `vi.advanceTimersByTimeAsync()` — follow the existing polling test pattern on line 449.
