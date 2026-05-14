---
id: T0008
title: Integration flow on task completion
status: new
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
- Use execa for all git commands (`git fetch`, `git rebase`, `git push`, `git worktree remove`, `git branch`) and for running the test command. Reuse the same execa pattern from T0003 and T0005 — native git CLI, never simple-git.

## Integration pipeline

Each step runs sequentially. Any failure aborts the pipeline and logs the error.

```
1. Detect status=done in worktree task file (via T0006 event)
2. cd to worktree directory
3. git fetch origin <mainBranch>
4. git rebase origin/<mainBranch>
   → CONFLICT: abort rebase, pause, notify user
5. Run test command from config.testCommand
   → FAIL: abort, log test output, pause
6. git push origin <taskBranch>
   → FAIL: abort, log error
7. cd to project root
8. git worktree remove .worktrees/<taskId>
9. git branch -d <taskBranch>    # branch is merged, safe to delete
10. Remove .ravel/sessions/<taskId>.json
11. Log "<taskId> integration complete"
```

## Rebase conflict handling

When step 4 produces a conflict:
1. Run `git rebase --abort` to restore state.
2. Log: "Rebase conflict for <taskId>. Resolve in Builder, then say LGTM."
3. The task stays at status `done`. The user returns to the Builder, fixes conflicts, and says "LGTM" again.
4. The Builder updates the status — but it's already `done`. This means the Builder should re-trigger status change. Design decision: the Builder sets status back to `review` on conflict resolution, then the user says LGTM again to set it to `done`. OR the user manually re-runs integration. **For v1, keep it simple**: after conflict resolution, the user manually runs `ravel integrate T0003`.

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

The TUI should show integration progress in the event log:
```
T0003 integration: rebasing onto main...
T0003 integration: tests passing
T0003 integration: pushed
T0003 integration complete
```

## Idempotency

Integration runs only if:
- The task has an active session (`.ravel/sessions/<taskId>.json` exists).
- The worktree still exists on disk.
- The task status is `done` and the status was just changed (not already integrated).

Track integrated task IDs in memory (Set<string>) to prevent double-integration within a single TUI session.
