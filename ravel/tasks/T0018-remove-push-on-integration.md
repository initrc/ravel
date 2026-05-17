---
id: T0018
title: Remove push-on-integration and add local merge to main
status: done
dependencies:
  - T0008
---

# Scope

- Replace the push step (step 4) in `runIntegration` with a local fast-forward merge of `main` to the feature branch — the feature branch was just rebased onto `main`, so this is always a fast-forward.
- Remove `pushOnIntegration` from the config schema, defaults, and tests.
- Remove the `hasRemote` helper since it was only used to gate the push step.
- Update `ravel/docs/design-v1.md` to reflect the local merge step instead of pushing.

# Acceptance

- `runIntegration` no longer pushes to origin under any condition.
- After rebase and tests pass, `main` is fast-forwarded to the feature branch (e.g., `git checkout main && git merge <branch>` from the project root).
- `pushOnIntegration` is gone from `ConfigSchema`, `DEFAULT_CONFIG`, and `config.test.ts`.
- `hasRemote` is removed from `integrate.ts`.
- Design doc describes the local merge step instead of pushing.

# Implementation Notes

- The push step is lines 173–186 in `integrate.ts`. Replace it with: checkout `main` from the project root and merge the feature branch (fast-forward).
- The merge must happen from `projectRoot` (the main working copy), not the worktree, since `main` is checked out there.
- The `hasRemote` helper is lines 20–27, and `originExists` is computed on line 49. Remove both.
- Config changes are in `src/commands/config.ts` and `src/commands/config.test.ts`.
- Design doc sections to update: integration flow step 4 (push → merge), the remote vs local-only repos section (remove entirely), the config example, and the `pushOnIntegration` description.
