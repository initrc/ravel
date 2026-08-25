---
id: T0051
title: Centralize task workflow conventions
status: done
dependencies: []
---

# Scope

- Make `ravel/docs/ravel-conventions.md` the single source of shared, workmux,
  and manual task lifecycle instructions, and reduce generated task prompts to
  task-specific runtime context.

# Acceptance

- Generated prompts contain the task ID, repository-relative task path, launch
  mode, and a direct reference to the matching workflow in
  `ravel/docs/ravel-conventions.md` without embedding lifecycle policy.
- The conventions template defines status transitions, verification, the
  explicit `LGTM` gate, commit rules, and concise workmux and manual workflows.
- The generated `AGENTS.md` section requires reading the conventions before
  implementing a task.
- README migration guidance tells existing projects to refresh their conventions
  file, and the v2 design documentation reflects the new ownership boundary.
- The repository conventions copy matches the packaged template.
- The project builds, passes lint, and all tests pass.

# Implementation Notes

- Start with `src/prompts/task-prompt.ts:11`,
  `templates/ravel-conventions.md:109`, and `templates/AGENTS.md:3`.
- Prompt lifecycle behavior was introduced in T0044; this task moves that
  policy into the conventions document while keeping launch mode dynamic.
- `src/prompts/ravel-conventions.test.ts:18` owns lifecycle contract coverage;
  prompt and launcher tests now verify only task-specific context and mode
  selection.
- The workmux rebase rationale remains in `ravel/docs/design-v2.md`; the
  operational conventions retain only the required command order and safety
  restrictions.
