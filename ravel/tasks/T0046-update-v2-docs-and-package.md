---
id: T0046
title: Update v2 docs and package metadata
status: new
dependencies:
  - T0045
---

# Scope

- Rewrite the user-facing README, installed conventions, and generated `AGENTS.md` guidance for the completed v2 picker, launcher, agent-owned integration, and user-owned cleanup workflow.
- Update package metadata for the `2.0.0` release and confirm the published package surface matches v2.

# Acceptance

- README documents supported macOS and Linux environments, prerequisites, bare `ravel`, first-run initialization, the fzf picker, tmux and non-tmux behavior, configuration, task status semantics including the derived `merging` state, agent review/integration, and manual cleanup without presenting removed v1 commands as available.
- README documents the best-effort ready-for-review and merged notifications, terminal OSC 9 support, and the tmux `allow-passthrough` config and live-server commands.
- README's "Migrating from v1" section contains the same numbered steps as the executable, explains that `.ravel/` contains only v1 local runtime state and configuration, and explicitly warns not to delete `.worktrees/`.
- `templates/ravel-conventions.md` and `templates/AGENTS.md` match the v2 lifecycle: no push or worktree deletion, local rebase plus fast-forward are allowed only after explicit `LGTM` when the Ravel task prompt requests them, and the conventions contain the exact environment-specific notification commands and non-blocking trigger rules.
- Initialization still preserves an existing conventions file and unrelated `AGENTS.md` content while installing the updated templates for new projects.
- Package metadata identifies version `2.0.0`, retains the `@initrc/ravel` package and `ravel` binary, and lists only `clipboardy`, `gray-matter`, and `zod` as runtime dependencies.
- The lockfile is consistent with `package.json`, and built/published files contain no stale v1 modules.
- Documentation and executable migration text are protected against drift by a shared source or an exact-agreement test.
- The project builds successfully, `npm run lint` passes, and `npm test` passes in full.

# Implementation Notes

- Start with `README.md:1`, `templates/ravel-conventions.md:109`, `templates/AGENTS.md:3`, and `package.json:1`.
- Follow the migration requirements in `ravel/docs/design-v2.md:127`, review guidance in `ravel/docs/design-v2.md:457`, cleanup rules in `ravel/docs/design-v2.md:512`, and packaging requirements in `ravel/docs/design-v2.md:540`.
- Describe the shipped workflow, not intermediate task boundaries. Keep the popup binding as an optional user example; Ravel itself invokes ordinary fzf.
- T0040 already removed v1 runtime dependencies. Recheck rather than reintroduce them, and update `package-lock.json` through the package manager rather than editing resolved dependency data by hand.
