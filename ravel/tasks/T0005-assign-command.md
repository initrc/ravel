---
id: T0005
title: ravel assign command
status: done
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
- Generate a launch command that cd's to the worktree, copies the prompt to clipboard via `ravel prompt --copy`, and launches the Builder.
- Optionally copy the launch command to clipboard.
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
12. Generate launch command (cd + ravel prompt + builder) → (never fails)
13. Present clipboard menu for the launch command     → (never fails)
```

## Launch command

Ravel does not launch the Builder automatically. Instead, it generates a launch command and optionally copies it to clipboard so the user can paste it in a new terminal tab.

The launch command is a pipeline:

```
ravel prompt T0003 --copy && cd .worktrees/T0003 && claude
```

`ravel prompt --copy` prints the prompt and copies it to clipboard without showing an interactive menu. When the Builder launches, the prompt is already in clipboard — the user just pastes it.

If `ravel` is not on PATH, the absolute path to `ravel.js` is used instead.

- Use `node:child_process` with `promisify(execFile)` for all git commands, same as T0003.

## Task status update

Use the `updateTaskStatus` function from T0002 to modify the task file *in the main repository* (not the worktree). The status change to `in-progress` happens before the Builder is launched.

## Config key

The config key `copyCommandByDefault` controls whether the launch command is copied to clipboard automatically (no menu) or the user is prompted with an interactive menu.
