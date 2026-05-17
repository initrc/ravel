---
id: T0008
title: Integration flow on task completion
status: done
dependencies:
  - T0003
  - T0006
---

# Scope

- Detect when a Builder marks a task `done` in a worktree.
- Git rebase the task branch onto the main branch.
- Run tests after rebase.
- Push the merged result.
- Remove the worktree and session file on success.
- Handle rebase conflicts: pause integration, inform user, wait for manual resolution.

# Acceptance

- Task marked `done` triggers the integration flow automatically.
- Successful rebase + tests → push → cleanup worktree and session.
- Rebase conflicts pause the flow and notify the user.
- User can re-trigger integration after resolving conflicts.
- Failed tests block the integration and report errors.

# Implementation Notes

- Builder owns code changes; Ravel owns integration.
- Integration is triggered by the file watcher (T0006) detecting a `task-status-changed` event to `done` in a worktree task file.
- Rebase target: configurable, defaults to `main`.
- Test command: configurable in `.ravel/config.json` (`testCommand` field).
- Use `node:child_process` with `promisify(execFile)` for all git commands (`git fetch`, `git rebase`, `git push`, `git worktree remove`, `git branch`) and for running the test command. Reuse the same pattern from T0003 — native git CLI, never simple-git.

## Integration pipeline

Each step runs sequentially. Any failure aborts the pipeline and logs the error.

```
1. Detect status=done in worktree task file (via T0006 event)
2. cd to worktree directory
3. If origin remote exists: git fetch origin <mainBranch>
4. git rebase <rebaseTarget>
   → <rebaseTarget> is origin/<mainBranch> when a remote exists, otherwise local <mainBranch>
   → CONFLICT: abort rebase, pause, notify user
5. Run test command from config.testCommand (skipped when empty)
   → FAIL: abort, log test output, pause
6. If origin remote exists and pushOnIntegration: git push origin <taskBranch>
7. cd to project root
8. git worktree remove --force .worktrees/<taskId>
9. git branch -D <taskBranch>
10. Remove .ravel/sessions/<taskId>.json
11. Update task status to done on the main branch
12. If origin remote exists: git pull --ff-only origin <mainBranch> (best-effort)
13. Log "<taskId> integration complete"
```

### No-remote repos

When the repo has no `origin` remote: fetch and push are skipped, rebase targets the local `main` branch, and the post-integration pull is skipped. All other steps (tests, cleanup, status update) still run.

## Rebase conflict handling

When the rebase step produces a conflict:
1. Run `git rebase --abort` to restore state.
2. Log: "Rebase conflict for <taskId>. Resolve the conflicts manually, then run 'ravel integrate <taskId>'."
3. The task stays at status `done`. The user resolves conflicts in the worktree.
4. After resolution, the user manually runs `ravel integrate <taskId>` to retry.

## Config additions

Add to `.ravel/config.json`:

```json
{
  "mainBranch": "main",
  "testCommand": "npm test",
  "pushOnIntegration": true
}
```

## Integration entry point

The integration flow is triggered by the file watcher. When the TUI's watcher detects a `done` status change in a worktree, it calls `runIntegration(taskId)`. This function implements the pipeline above.

The TUI shows integration progress in the event log:
```
T0003 integration: starting...
T0003 integration: Fetching origin/main...
T0003 integration: Rebasing onto origin/main...
T0003 integration: Running tests: npm test
T0003 integration: Tests passed
T0003 integration: Pushing T0003-apply-shadcn-ui-primitives to origin...
T0003 integration: Pushed
T0003 integration: Cleaning up worktree and branch...
T0003 integration: Pulling latest main...
T0003 integration: Local main is up to date
T0003 integration complete
```

## Idempotency

Integration runs only if:
- The task has an active session (`.ravel/sessions/<taskId>.json` exists).
- The worktree still exists on disk.
- The task status is `done` and the status was just changed (not already integrated).

Track integrated task IDs in memory (Set<string>) to prevent double-integration within a single TUI session.

## Main branch stays clean during active work

When `ravel assign` creates a worktree, it updates the task status to `in-progress` in the **worktree's** copy of the task file, not on the main branch. This keeps the main branch clean — no uncommitted status changes accumulate during active development.

The TUI merges worktree statuses into its task list: after loading from the main repo's `ravel/tasks/`, it iterates over active session files (`.ravel/sessions/*.json`) and overrides each task's status with the worktree copy. This way, when a Builder marks a task `review` or `done` in the worktree, the TUI immediately reflects it in the correct column.

When integration succeeds, the pipeline updates the task status on the main branch to `done` (so dependent tasks become assignable). This is the only time the main branch's task file is touched during the lifecycle.
