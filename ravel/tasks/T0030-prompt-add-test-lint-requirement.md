---
id: T0030
title: Add "make sure all tests and lint passed" to prompt
status: new
dependencies: []
---

# Scope

Add "make sure all tests and lint passed" as the first bullet under "When the implementation is ready for human review:" in `generatePrompt()` in `src/commands/prompt.ts`.

# Acceptance

- `generatePrompt()` output includes the new bullet as the first item under "When the implementation is ready for human review:".
- `npm run build` succeeds.
- `npm test` passes.

# Implementation Notes

- Only file changed is `src/commands/prompt.ts`.
- The new bullet goes before "update the task status to review" and after the "When the implementation is ready for human review:" heading line.
