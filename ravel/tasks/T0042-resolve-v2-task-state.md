---
id: T0042
title: Resolve v2 task state
status: new
dependencies:
  - T0041
---

# Scope

- Retain the Markdown task parser and implement a read-only v2 task-state scan that separates committed `baseBranch` integration state from live task branch or worktree state.
- Discover task branches and registered worktrees from Git instead of runtime files, and expose the display status, applicable preview file, incomplete dependencies, and launch eligibility needed by the picker and lifecycle code.

# Acceptance

- Valid task statuses continue to parse, malformed tasks and missing dependency references fail clearly, and `blocked` is never persisted.
- Tasks are enumerated from the primary checkout, including dirty or untracked task files, while committed `baseBranch` copies remain authoritative for integration and dependency satisfaction.
- A base task committed as `done` is hidden; a base `new` task displays live `in-progress`, `review`, or the derived `merging` state for branch status `done` from its task worktree or unregistered task branch.
- A primary task committed as `in-progress` or `review`, or a registered task branch that has not advanced to `in-progress`, is reported as invalid lifecycle state.
- Dependents remain blocked until every dependency is committed as `done` on `baseBranch`, regardless of a dependency's live worktree status.
- Dirty, untracked, or base-divergent task files are visibly marked and cannot be launched.
- Branch names come from task filenames, canonical paths use `.worktrees/<task-id>`, and registered worktree paths from `git worktree list --porcelain` take precedence over the canonical path.
- An existing task branch without a worktree can supply live status for later reattachment; ambiguous branch or worktree mappings fail with recovery guidance.
- Tests cover every base-versus-live status combination and use temporary Git repositories.
- The project builds successfully, `npm run lint` passes, and `npm test` passes in full.

# Implementation Notes

- Start with the parser and dependency logic retained from `src/models/task.ts:6` and the Git execution helper retained from `src/commands/git.ts:6`.
- Follow the authoritative state table and edge cases in `ravel/docs/design-v2.md:190`, the Git discovery rules in `ravel/docs/design-v2.md:305`, and the task-state tests in `ravel/docs/design-v2.md:604`.
- T0040 removed the v1 session overlay. Model base status and display status separately so dependency checks cannot accidentally consume live branch or worktree state.
- Read registered paths from porcelain records rather than parsing the human-formatted `git worktree list` output.
- Do not add a replacement runtime registry. Git plus task frontmatter are the only state stores in v2.
