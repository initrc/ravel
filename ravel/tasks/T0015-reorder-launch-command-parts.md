---
id: T0015
title: Reorder launch command parts in assign output
status: new
dependencies: []
---

# Scope

- Change `generateLaunchCommand()` in `src/commands/prompt.ts` so the three parts are ordered: `cd <worktree>` first, then `ravel prompt --copy`, then the builder command.
- Applies to both the CLI `ravel assign` output and the TUI `/assign` command output (they share `generateLaunchCommand`).

# Acceptance

- `generateLaunchCommand()` produces `cd '<worktreePath>' && ravel prompt <taskId> --copy && <builderCommand>`.
- `npm run build` succeeds.
- `npm test` passes.

# Implementation Notes

- The only file to change is `src/commands/prompt.ts`, lines 63-74.
- During dev, `ravel` isn't in PATH globally, so `ravel prompt --copy` fails when run from a non-npm folder. cd-ing into the worktree (which is in the project) first ensures `ravel` is available.
