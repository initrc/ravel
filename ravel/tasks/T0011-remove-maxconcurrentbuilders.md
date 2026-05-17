---
id: T0011
title: Remove maxConcurrentBuilders config
status: new
dependencies: []
---

# Scope

- Remove `maxConcurrentBuilders` from the Zod `ConfigSchema` and `DEFAULT_CONFIG`.
- Remove all references in tests and config file.
- Remove it from the TUI `/config` display command.
- Remove it from task docs and design docs.

# Acceptance

- `maxConcurrentBuilders` no longer appears in config schema, defaults, or types.
- All tests pass without referencing it.
- `.ravel/config.json` no longer contains the field.
- TUI `/config` no longer displays it.
- Design doc and task doc references removed.

# Implementation Notes

- Primary source file is `src/commands/config.ts` — schema, type, and defaults.
- Test files to update: `src/commands/config.test.ts`, `src/commands/init.test.ts`.
- TUI display reference at `src/tui/app.tsx:250`.
- Project config at `.ravel/config.json`.
- Docs: `ravel/docs/design-v1.md` and `ravel/tasks/T0001-project-scaffolding.md`.
- The field was never wired to any concurrency-limiting logic, so runtime behavior is unaffected.
