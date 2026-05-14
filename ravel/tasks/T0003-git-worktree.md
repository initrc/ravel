---
id: T0003
title: Git worktree and branch management
status: new
dependencies:
  - T0001
  - T0002
---

# Scope

- Create git branches from task filenames (e.g., `T0003-apply-shadcn-ui-primitives`).
- Create git worktrees at `.worktrees/T0003/`.
- Register runtime session files at `.ravel/sessions/T0003.json`.
- Remove worktrees and session files on cleanup.
- Validate that a task isn't already assigned before creating a new worktree.

# Acceptance

- Branch name is derived correctly from task filename.
- Worktree is created at `.worktrees/<task-id>/`.
- Session JSON file is written with `taskId`, `branch`, `worktreePath`.
- Duplicate assignment is prevented (check for existing session file).
- Cleanup removes worktree and session file.

# Implementation Notes

- **Use native git CLI** for worktree operations. Do NOT use simple-git for worktrees — its worktree support is unreliable. Use `execa` to run git commands. simple-git may still be used for simpler operations like `git branch`.
- Worktree base: use `HEAD` (the current branch tip) as the base ref. This means worktrees branch off wherever the user currently is.
- Branch naming: strip `.md` from the task filename, e.g., `T0003-apply-shadcn-ui-primitives.md` → branch `T0003-apply-shadcn-ui-primitives`.

## Session file format

```ts
interface Session {
  taskId: string;            // e.g. "T0003"
  branch: string;            // e.g. "T0003-apply-shadcn-ui-primitives"
  worktreePath: string;      // e.g. ".worktrees/T0003"
}
```

Written to `.ravel/sessions/<taskId>.json`. The session file is the source of truth for whether a task is currently assigned. A task is "assigned" iff its session file exists.

## Commands

All paths are relative to the project root.

**Create worktree:**
```bash
git branch <branch-name> HEAD
git worktree add .worktrees/<task-id> <branch-name>
```

**Remove worktree:**
```bash
git worktree remove .worktrees/<task-id>
git branch -D <branch-name>
```

**Check if branch/worktree exists:**
Use `git worktree list` and `git branch --list <name>` before creating.

## Duplicate prevention

Before creating a worktree, check in order:
1. Does `.ravel/sessions/<taskId>.json` exist? → reject, already assigned.
2. Does `git worktree list` show `.worktrees/<taskId>`? → reject, stale worktree exists, tell user to clean up.
3. Does `git branch --list <branchName>` show the branch? → reject, stale branch exists.

## Worktree path on disk

Worktree root is the project root. Worktree at `<projectRoot>/.worktrees/T0003/`. Inside the worktree, `ravel/tasks/` contains a copy of the task files at the time of branching. The Builder modifies the task file *inside the worktree*, and the file watcher (T0006) picks that up.
