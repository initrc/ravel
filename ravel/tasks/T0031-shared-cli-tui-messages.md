---
id: T0031
title: Centralize shared message templates for CLI and TUI
status: done
dependencies: []
---

# Scope

Extract duplicated message strings used by both `/assign` and `/integrate` into a shared module (`src/commands/messages.ts`) so CLI and TUI stay consistent by construction.

While comparing outputs, fix two issues:
- `/assign` instruction text had an ABBA flow (talked about the future prompt copy before the user had even seen the command to run). Simplified 3-line instruction block to 1 line.
- `/integrate` TUI test-failure handler was silently dropping `event.output`.

# What changed

- Created `src/commands/messages.ts` with `fmtAssignWorktree`, `fmtAssignBranch`, `ASSIGN_LAUNCH_INSTRUCTION`, and `fmtIntegrationComplete`.
- Updated `src/ravel.ts` and `src/tui/app.tsx` to import and use the shared symbols instead of inline string templates.
- Simplified `ASSIGN_LAUNCH_INSTRUCTION` from a 3-line block to `"\nRun this command in a new terminal.\n"`. The clipboard/paste instruction is handled by `ravel prompt --copy` when it actually runs.
- Added `console.error(event.output)` to the TUI test-failure handler, matching CLI behavior.

# Acceptance

- `npm run build` succeeds.
- `npm test` passes.
