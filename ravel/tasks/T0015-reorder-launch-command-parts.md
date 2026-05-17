---
id: T0015
title: Reorder launch command parts in assign output
status: done
dependencies: []
---

# Scope

- Change `generateLaunchCommand()` in `src/commands/prompt.ts` so the four parts are ordered: `cd <projectRoot>` first, then `ravel prompt --copy`, then `cd <relativeWorktree>`, then the builder command.
- Applies to both the CLI `ravel assign` output and the TUI `/assign` command output (they share `generateLaunchCommand`).
- Added `projectRoot` parameter to `generateLaunchCommand` so the command cds into a ravel-initialized repo before running `ravel prompt --copy`, ensuring `ravel` is executable anywhere.

# Acceptance

- `generateLaunchCommand()` produces `cd '<projectRoot>' && ravel prompt <taskId> --copy && cd '<relativeWorktreePath>' && <builderCommand>`.
- `npm run build` succeeds.
- `npm test` passes.

# Implementation Notes

- The only files changed are `src/commands/prompt.ts`, `src/ravel.ts`, `src/tui/app.tsx`, and `src/commands/prompt.test.ts`.
- `ravel` requires running in a ravel-initialized repo. The first `cd` to `projectRoot` ensures this condition is met before invoking `ravel prompt --copy`. The worktree is expressed as a relative path from `projectRoot` using `path.relative()`.

# Update 2026-05-17

Added `projectRoot` parameter because `ravel` won't run outside a ravel-initialized repo. The updated command order is:
1. `cd <projectRoot>` — enter the ravel-initialized repo where `ravel` works
2. `ravel prompt <taskId> --copy` — generate and copy the prompt
3. `cd <relativeWorktreePath>` — enter the worktree (relative path from project root)
4. `<builderCommand>` — launch the coding agent
