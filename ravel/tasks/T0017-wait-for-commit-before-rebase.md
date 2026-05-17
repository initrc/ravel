---
id: T0017
title: Wait for commit to land before rebasing during integration
status: done
dependencies: []
---

# Scope

- The file watcher fires on the task-status file write (`updateTaskStatus` → "done"), which can happen before the agent's `git commit` completes. This triggers integration while the worktree still has unstaged changes, causing `git rebase main` to fail with "cannot rebase: You have unstaged changes."
- Instead of immediately rebasing, `runIntegration` should poll `git status --porcelain` in the worktree until it's clean (the commit has landed), then proceed.
- Time out after ~15s with a clear error if the worktree never becomes clean.

# Acceptance

- Integration no longer fails with "unstaged changes" when the file-watcher triggers it before the done commit lands.
- The wait loop is a no-op when the worktree is already clean (no added latency).
- Manual `/integrate` commands also benefit from the same wait logic.
- A clear error is shown if the worktree stays dirty past the timeout.
