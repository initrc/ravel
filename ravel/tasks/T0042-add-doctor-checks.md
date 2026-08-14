---
id: T0042
title: Add doctor checks
status: done
dependencies:
  - T0041
---

# Scope

- Implement `ravel doctor` as a runner over independent mandatory and recommended checks.
- Add one module per initial executable check and reuse the runner for bare `ravel`'s mandatory-only preflight.

# Acceptance

- Every check has a stable name, `mandatory` or `recommended` level, command arguments, result state, and captured output.
- Each check runs its command without a shell and treats a missing command or non-zero exit as failure.
- Individual modules check `fzf --version` as mandatory and `git --version`, `tmux -V`, tmux `allow-passthrough`, and `workmux --version` as recommended.
- The passthrough check is not applicable outside `$TMUX`; inside tmux it runs `tmux show-options -gqv allow-passthrough`, accepts `all`, reports `on` as limited to visible panes, and warns on `off` or an empty value.
- Passthrough guidance shows both `set -g allow-passthrough all` for tmux configuration and `tmux set -g allow-passthrough all` for the running server without editing either itself.
- `ravel doctor` runs and prints all checks in a stable order, exits 1 when any mandatory check fails, and exits 0 when only recommended checks fail.
- Bare `ravel` runs only mandatory checks, exits 1 before later workflow work on failure, and stays quiet on success.
- The runner can filter by level and returns collected results for later workmux fallback decisions.
- Tests use fake executables and environment values and cover success, non-zero exits, missing commands, output capture, filtering, display levels, not-applicable checks, `on` versus `all`, guidance, and exit codes.
- The project builds successfully, `npm run lint` passes, and `npm test` passes in full.

# Implementation Notes

- Start from the command routing in `src/ravel.ts:1` added by T0041 and place the doctor runner under a focused `src/doctor/` module.
- Follow the check contract and initial table at `ravel/docs/design-v2.md:115`.
- Keep process execution behind an injectable boundary so tests do not depend on the developer machine's installed tools.
- Do not shell out through a command string and do not add package-manager, version-range, configuration, or network checks.
