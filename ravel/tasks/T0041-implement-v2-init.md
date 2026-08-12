---
id: T0041
title: Implement v2 initialization
status: done
dependencies: []
---

# Scope

- Replace the minimal post-v1 shell with the v2 public interface: bare `ravel`, `ravel init`, `ravel doctor`, `ravel --help`, and `ravel --version`.
- Implement idempotent `ravel init` using the existing conventions and `AGENTS.md` templates.
- Leave bare `ravel` and `ravel doctor` as explicit handoff points for later tasks.

# Acceptance

- `ravel --help` and `ravel --version` work; unknown arguments or subcommands fail with concise usage.
- `ravel init` creates `ravel/docs/`, `ravel/tasks/`, and the conventions file when missing and creates or updates only the Ravel section of `AGENTS.md`.
- Initialization preserves an existing conventions file and unrelated `AGENTS.md` content and is idempotent.
- Initialization does not create `.ravel/` or `.worktrees/`, edit `.gitignore`, inspect Git, select an agent, write configuration, or initialize workmux.
- Bare `ravel` and `ravel doctor` report that their workflows arrive in T0043 and T0042 respectively without exposing removed v1 commands.
- Tests use temporary directories and injectable template paths.
- The project builds successfully, `npm run lint` passes, and `npm test` passes in full.

# Implementation Notes

- Start with `src/ravel.ts:1`, `templates/AGENTS.md:1`, and `templates/ravel-conventions.md:1`.
- Follow the public interface at `ravel/docs/design-v2.md:67` and initialization contract at `ravel/docs/design-v2.md:96`.
- Reuse the surgical Ravel-section replacement behavior from the v1 `init` implementation, without restoring agent selection, config, Git ignore entries, sessions, or logs.
- Keep command routing small; no CLI framework is needed for three command forms and two standard flags.
