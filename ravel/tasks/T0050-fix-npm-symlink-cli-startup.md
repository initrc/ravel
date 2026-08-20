---
id: T0050
title: Fix npm symlink CLI startup
status: done
dependencies: []
---

# Scope

- Ensure the Ravel CLI starts when npm invokes its installed binary through a
  symlink.
- Prepare a patch release after the broken `2.0.0` publication.

# Acceptance

- `ravel`, `ravel --help`, and `ravel --version` execute through an npm-style
  binary symlink instead of exiting silently.
- An end-to-end regression test covers symlinked CLI invocation.
- The package version and published-package assertions are updated to `2.0.1`.
- The project builds, passes lint, and all tests pass.

# Implementation Notes

- Canonicalize the invoked executable path in `src/ravel.ts` before comparing
  it with the module path.
- Exercise the built binary through a temporary symlink in
  `src/ravel.e2e.test.ts`.
- Keep `package.json`, `package-lock.json`, and the package-content test version
  synchronized for the patch release.
