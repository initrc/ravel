---
id: T0041
title: Implement the v2 entrypoint and initialization
status: new
dependencies:
  - T0040
---

# Scope

- Replace the minimal post-v1 shell with the v2 public interface: `ravel`, `ravel --help`, and `ravel --version` only.
- Resolve the primary checkout from any directory in the primary worktree or a linked worktree, then load configuration and planning files relative to that root.
- Implement prerequisite checks, v1 and unsupported-schema detection, confirmation-gated first-run initialization, and the minimal v2 configuration schema.

# Acceptance

- `ravel --help` and `ravel --version` work, and no public subcommands are registered.
- Invocation from the primary root, a nested directory, or a linked worktree resolves the same primary project root; invocation outside Git exits with a clear error.
- Missing Git worktree support or `fzf` is reported before Ravel mutates project files.
- A v1-shaped config prints the migration procedure from the design and exits without mutation; an unknown `configVersion` reports that version and is not treated as v1.
- First-run initialization occurs only after confirmation, preserves unrelated file content, creates only the v2 directories, detects the primary worktree's current branch, offers installed agents plus copy-only and custom-command choices, and writes `configVersion: 2`, `agentCommand`, and `baseBranch`.
- When initialization runs inside tmux, it checks the effective global `allow-passthrough` option, prints setup guidance when it is not `on`, and continues without inspecting or editing tmux configuration; outside tmux the option is not required.
- A configured `baseBranch` must name an existing local branch, and Ravel never fetches to update it.
- Initialization returns control to the bare-command workflow so T0043 can open the picker; when no open tasks exist, the command reports that fact.
- Tests use temporary Git repositories and fake executables rather than requiring an installed `fzf` or agent.
- The project builds successfully, `npm run lint` passes, and `npm test` passes in full.

# Implementation Notes

- Start with the minimal `src/ravel.ts:1` left by T0040, the retained Git execution helper, and the templates under `templates/`.
- Follow `ravel/docs/design-v2.md:52` for prerequisites, `ravel/docs/design-v2.md:88` for configuration and migration detection, and `ravel/docs/design-v2.md:156` for primary-root resolution and initialization behavior.
- Node.js is already present when the JavaScript entrypoint runs; preflight the external executables Ravel invokes and keep all checks ahead of initialization writes.
- Use Git's common directory and `git worktree list --porcelain` to identify the primary checkout. Do not infer it by walking upward for `.git`, because linked worktrees use a `.git` file.
- T0040 intentionally removed the incompatible v1 config and initialization flow. Reuse its former idempotent file-update behavior from history only where it directly satisfies v2; do not restore `.ravel/sessions/` or `.ravel/logs/`.
- Keep migration output in one shared constant or formatter so the executable and README can be checked for exact agreement in T0046.
