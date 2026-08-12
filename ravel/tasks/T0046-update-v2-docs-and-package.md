---
id: T0046
title: Update v2 docs and package metadata
status: new
dependencies:
  - T0045
---

# Scope

- Rewrite the user-facing README for the completed v2 init, doctor, picker, prompt, workmux delegation, and manual fallback workflow.
- Update package metadata for the `2.0.0` release and confirm the published package surface matches v2.

# Acceptance

- README documents supported macOS and Linux environments, `ravel init`, `ravel doctor`, mandatory fzf, recommended Git/tmux/workmux and passthrough, bare `ravel`, live worktree status discovery, `ready-to-merge`, the fzf picker, direct workmux prompt injection, the manual prompt variant and clipboard-only fallback, the review gate, agent-owned `workmux rebase`, and the verified `workmux merge --rebase --notification` handoff without presenting removed v1 commands as available.
- README links to workmux, shows the minimal `agent`, `base_branch: auto`, and `<agent>` pane configuration, and explains that workmux owns agent commands, branch behavior, worktree paths, shared files, windows, merge, and cleanup.
- README's "Migrating from v1" section has one instruction: remove `.ravel/`. It explains that committed `ravel/` files and the existing Ravel `AGENTS.md` section remain valid.
- README documents OSC 9 ready-for-review notifications and why tmux users should set `allow-passthrough all`, including persistent and live-server commands.
- `templates/ravel-conventions.md` and `templates/AGENTS.md` remain reusable without lifecycle changes; the generated prompt explicitly marks its two post-`LGTM` workmux commands as narrow task-specific exceptions to the general merge and deletion prohibitions.
- Initialization continues to preserve an existing conventions file and unrelated `AGENTS.md` content.
- Package metadata identifies version `2.0.0`, retains the `@initrc/ravel` package and `ravel` binary, and lists only `clipboardy`, `gray-matter`, and `zod` as runtime dependencies.
- The lockfile is consistent with `package.json`, and built/published files contain no stale v1 modules.
- The project builds successfully, `npm run lint` passes, and `npm test` passes in full.

# Implementation Notes

- Start with `README.md:1`, `templates/ravel-conventions.md:1`, `templates/AGENTS.md:1`, and `package.json:1`.
- Follow configuration ownership at `ravel/docs/design-v2.md:426`, migration at `ravel/docs/design-v2.md:450`, and the removed/retained inventory at `ravel/docs/design-v2.md:462`.
- Describe the shipped workflow, not intermediate task boundaries. Link to workmux's current documentation for installation and configuration details rather than copying its full reference.
- T0040 already removed v1 runtime dependencies. Recheck rather than reintroduce them, and update `package-lock.json` through the package manager rather than editing resolved dependency data by hand.
