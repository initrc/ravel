---
id: T0040
title: Remove the v1 runtime
status: done
dependencies:
  - T0039
---

# Scope

- Remove the unequivocally obsolete v1 runtime, tests, built surface, and dependencies before v2 implementation begins.
- Leave a minimal compiling `ravel` entrypoint and only the small source primitives that the workmux-based v2 may reuse.

# Acceptance

- Ink and React TUI code, slash commands, Commander routing, Chokidar watching, event and notification machinery, session JSON and logs, automatic integration, cleanup commands, and obsolete clipboard/config behavior are absent from source, tests, and built output.
- The retained implementation is limited to potentially useful v2 primitives such as task filename/frontmatter parsing, task status updates, dependency validation, Git command execution, and raw clipboard writing; later tasks may remove retained helpers that workmux makes unnecessary.
- `ravel` exposes no v1 subcommands. Until T0041 implements the functional v2 entrypoint, bare invocation may report that the v2 workflow is not yet available.
- The build starts from a clean output directory so deleted v1 modules cannot survive under `bin/`.
- Runtime dependencies are reduced to `clipboardy`, `gray-matter`, and `zod`; packages used only by removed v1 code are removed from the lockfile as well.
- Tests for retained behavior remain, tests for deleted behavior are removed, and the remaining suite provides a green baseline for v2 development.
- The package remains at its current release version until T0046 updates the complete implementation to `2.0.0`.
- The project builds successfully, `npm run lint` passes, and `npm test` passes in full.

# Implementation Notes

- Start with routing and removal candidates in `src/ravel.ts:1`, `src/tui/`, `src/watcher.ts:1`, `src/models/session.ts:1`, `src/models/events.ts:1`, `src/commands/integrate.ts:1`, and `src/commands/notify.ts:1`.
- Review `src/commands/assign.ts:10`, `src/commands/prompt.ts:6`, `src/models/task.ts:6`, and `src/commands/git.ts:6` in the v1 snapshot before deleting files. Preserve only small primitives that may fit v2; do not retain their orchestration wrappers.
- This task is the completed mechanical cleanup baseline described in the removed v1 surface at `ravel/docs/design-v2.md:462`. Backwards compatibility is a non-goal, so the public workflow may remain unavailable until T0041.
- Do not implement initialization, doctor checks, fzf, prompt generation, or workmux delegation here. The minimal entrypoint is only a compiling boundary for subsequent tasks, not a temporary alternate workflow.
- Update `package.json`, `package-lock.json`, and the build script together. Ensure a build after source deletion cannot leave stale compiled files from a prior run.
