---
id: T0047
title: Verify v2 end to end
status: new
dependencies:
  - T0046
---

# Scope

- Complete end-to-end automated coverage of initialization, doctor, task selection, prompting, workmux delegation, manual fallback, packaging, and the safety invariants in the v2 design.
- Remove any remaining v1 artifact discovered by the final source, dependency, or package audit.

# Acceptance

- Temporary-directory tests cover primary and linked project discovery, initialization, every doctor level and exit path, tmux passthrough values, Git porcelain worktree mapping, live task states, fzf ordering and cancellation, blocked and `merge-ready` tasks, workmux and manual prompt variants, prompt notifications and post-approval integration, workmux arguments and failures, and manual fallback.
- Test doubles ensure the suite does not require interactive fzf, Git repositories, a tmux server, workmux, a real clipboard, or an installed coding agent.
- `ravel`, `ravel init`, and `ravel doctor` are the complete documented public workflow; removed v1 subcommands fail.
- Ravel uses Git only for read-only registered-worktree discovery; creation, opening, merging, repair, removal, and tmux behavior occur only through the workmux delegation boundary.
- README migration instructions say only to remove `.ravel/` and preserve the existing committed Ravel planning files and `AGENTS.md` guidance.
- Source, dependency, and clean-build audits find no Ink/React TUI, Commander routing, Chokidar watcher, session, Ravel config, mutating Git lifecycle, direct tmux launcher, direct agent launcher, Ravel-owned integration, notification process/config, or cleanup-command remnants.
- A package dry run shows only the intended v2 files and correct `2.0.0` metadata.
- The project builds successfully, `npm run lint` passes, and `npm test` passes in full.

# Implementation Notes

- Start with the complete test plan in `ravel/docs/design-v2.md:505` and final acceptance at `ravel/docs/design-v2.md:557`.
- Test the public executable at process boundaries in temporary directories while using fake `fzf`, Git, tmux, workmux, and clipboard implementations. Do not weaken tests by reaching only into internal helpers.
- Rebuild from a clean `bin/` directory before inspecting the package so stale artifacts cannot be mistaken for current output.
- Any cleanup in this task must be limited to v1 remnants found by the audit. Do not refactor working v2 code or add behavior beyond `ravel/docs/design-v2.md`.
