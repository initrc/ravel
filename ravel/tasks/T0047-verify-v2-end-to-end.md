---
id: T0047
title: Verify v2 end to end
status: new
dependencies:
  - T0046
---

# Scope

- Complete end-to-end automated coverage of initialization, task and picker state, Git lifecycle, launching, prompting, packaging, and the safety invariants in the v2 design.
- Remove any remaining v1 artifact discovered by the final source, dependency, or package audit.

# Acceptance

- Temporary Git repository tests cover root discovery, initialization and migration, all base-versus-live task states, fzf ordering and cancellation, worktree creation and recovery, tmux resume, direct launching, copy-only mode, and prompt safety.
- Test doubles ensure the suite does not require interactive fzf, a tmux server, a real clipboard, or an installed coding agent.
- `ravel` is the complete documented workflow and exposes no public subcommands.
- Parallel tasks use separate worktrees, and no Ravel action automatically merges, stashes, pushes, force-deletes, or removes completed worktrees or branches.
- README migration instructions exactly match executable output and preserve existing `.worktrees/`.
- Source, dependency, and clean-build audits find no Ink/React TUI, Commander routing, Chokidar watcher, session, integration, notification, or cleanup-command remnants.
- A package dry run shows only the intended v2 files and correct `2.0.0` metadata.
- The project builds successfully, `npm run lint` passes, and `npm test` passes in full.

# Implementation Notes

- Start with the complete test plan in `ravel/docs/design-v2.md:584` and final acceptance in `ravel/docs/design-v2.md:637`.
- Test the public executable at process boundaries in temporary repositories while using fake `fzf`, tmux, agent, and clipboard implementations. Do not weaken tests by reaching only into internal helpers.
- Rebuild from a clean `bin/` directory before inspecting the package so stale artifacts cannot be mistaken for current output.
- Any cleanup in this task must be limited to v1 remnants found by the audit. Do not refactor working v2 code or add behavior beyond `ravel/docs/design-v2.md`.
