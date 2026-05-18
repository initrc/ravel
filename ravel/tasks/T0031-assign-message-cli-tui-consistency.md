---
id: T0031
title: Make assign and other command messages consistent between CLI and TUI
status: new
dependencies: []
---

# Scope

Compare the `/assign` command output in the CLI (`src/ravel.ts`) and TUI (`src/tui/app.tsx`) and make them consistent. The TUI is missing `Branch:` info that the CLI shows. Check other shared commands (`/integrate`) for similar inconsistencies and fix them.

# Acceptance

- The `/assign` command output in the TUI includes branch information, consistent with the CLI output.
- Other shared command messages (e.g. `/integrate`) are verified consistent between CLI and TUI, or discrepancies are documented.
- `npm run build` succeeds.
- `npm test` passes.

# Implementation Notes

- The `Session` object returned by `assignCommand()` already includes `branch`, `taskId`, and `worktreePath`.
- CLI assign output: `src/ravel.ts` lines 44-66.
- TUI assign output: `src/tui/app.tsx` lines 303-331.
- CLI integrate output: `src/ravel.ts` lines 109-144.
- TUI integrate output: `src/tui/app.tsx` lines 334-337.
