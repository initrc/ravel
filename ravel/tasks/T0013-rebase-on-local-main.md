---
id: T0013
title: Rebase on local main instead of origin/main during integration
status: done
dependencies: []
---

# Scope

- When integrating a task, rebase onto local `main` instead of `origin/main`.
- Before rebasing, stash any uncommitted changes (including temporary work).
- After integration succeeds or fails, pop the stash to restore temporary changes.
- Log all stash and stash-pop actions.
- Update `ravel/docs/design-v1.md` with this design decision.

# Acceptance

- `ravel integrate` never fetches from or rebases onto `origin/main`.
- Integration rebases onto the local `main` branch only.
- Uncommitted changes are stashed before rebase and popped after (on both success and failure).
- Stash/pop actions are logged so the user knows what happened to their working state.
- `design-v1.md` reflects the local-first rebase behavior.

# Implementation Notes

- Ravel is local-first; it should never push to remotes or trigger GitHub PR prompts.
- Stash safety: if `git stash pop` fails (e.g., conflicts with restored changes), surface the error and tell the user their changes are in the stash.
- Check for dirty working tree before rebasing to decide whether to stash.
