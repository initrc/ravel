---
id: T0005
title: ravel assign command
status: new
dependencies:
  - T0002
  - T0003
  - T0004
---

# Scope

- Implement `ravel assign T0003` command that runs the full assignment flow.
- Validate project is initialized.
- Validate task exists and is in `new` status.
- Validate all dependencies are `done`.
- Create git branch and worktree (T0003).
- Update task status to `in-progress`.
- Generate Builder prompt (T0004).
- Optionally copy prompt to clipboard.
- Launch the configured Builder command.
- Register the runtime session.

# Acceptance

- `ravel assign T0003` rejects assignment if dependencies are not done.
- `ravel assign T0003` rejects assignment if task is already in progress.
- Branch and worktree are created before Builder launches.
- Task status is updated to `in-progress` before Builder launches.
- Builder is launched in the worktree directory.
- Session file is created after successful assignment.

# Implementation Notes

- Builder command comes from `.ravel/config.json` `builderCommand`.
- Launch Builder in a new terminal (separate process).
- The assign command runs in its own terminal, not the TUI.

## Execution order (all validation before any mutation)

The assign flow is a linear pipeline. Each step aborts on failure with a clear message:

```
1. Check .ravel/config.json exists                    → not found → "This does not look like a Ravel project. Run: ravel init"
2. Load TaskCollection from ravel/tasks/              → task not found → "Task T0003 not found"
3. Validate task.status === "new"                     → not new → "Task T0003 is already in-progress"
4. Validate all dependencies are "done"               → blocked → "Task T0003 is blocked. Depends on: T0001 (in-progress)"
5. Check no session file exists for this task         → exists → "Task T0003 is already assigned"
6. Check no existing branch/worktree (T0003 safety)   → exists → "Stale worktree for T0003 exists. Run ravel cleanup T0003"
7. Create git branch from HEAD                        → git error → abort with git error message
8. Create git worktree at .worktrees/<taskId>         → git error → abort, clean up branch
9. Update task status to "in-progress"                → fs error → abort, clean up branch + worktree
10. Write session file                                → fs error → abort, clean up branch + worktree
11. Generate and print Builder prompt                 → (never fails)
12. Present clipboard menu                            → (never fails)
13. Launch Builder in worktree directory              → spawn error → warn, session remains valid
```

## Builder command

Ravel does not launch the Builder automatically. Instead, it puts the appropriate command in the clipboard so the user can open a new terminal tab and paste it.

- Copy the builder command (e.g., `cd .worktrees/T0003 && claude`) to the clipboard.
- Use `node:child_process` with `promisify(execFile)` for all git commands, same as T0003.

## Task status update

Use the `updateTaskStatus` function from T0002 to modify the task file *in the main repository* (not the worktree). The status change to `in-progress` happens before the Builder is launched.

## Config key

The config key for assignment preference is `copyAssignCommandByDefault`, distinct from `copyPromptByDefault`. When both are `true`, both the assign command text and the builder prompt are copied to clipboard during assignment.
