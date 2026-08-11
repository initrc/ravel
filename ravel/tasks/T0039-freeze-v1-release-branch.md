---
id: T0039
title: Freeze the v1 release branch
status: done
dependencies: []
---

# Scope

- Preserve the released v1 code by creating branch `v1` at the existing `v1.0.3` tag and publishing that branch to `origin` before v2 implementation begins.
- Treat `v1` as a frozen release snapshot; all v2 development continues on `main`.

# Acceptance

- Local branch `v1`, remote branch `origin/v1`, and the dereferenced `v1.0.3` tag resolve to the same commit.
- The existing `v1.0.3` tag is unchanged.
- No v2 development commits are made on `v1`.
- The primary checkout remains on `main` for the subsequent v2 tasks.

# Implementation Notes

- Start with the version-preservation requirements in `ravel/docs/design-v2.md:41` and the first implementation-plan step at `ravel/docs/design-v2.md:565`.
- This is a human-operated release task: `ravel/docs/ravel-conventions.md:129` prohibits an implementing agent from pushing. The agent may verify refs and provide the exact push command, but a human must authorize and perform the push.
- Create the branch from the tag, not from the current `main` tip. Compare commit objects using the dereferenced tag so an annotated tag object is not mistaken for its target commit.
- Do not move, recreate, or otherwise modify the existing `v1.0.3` tag.
