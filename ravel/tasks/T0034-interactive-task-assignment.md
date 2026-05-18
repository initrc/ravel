---
id: T0034
title: Add interactive task assignment mode
status: new
dependencies: []
---

# Scope

Add an interactive mode triggered by pressing "i" that lets the user assign a task to the AI agent from a selectable list. Update the CommandInput hint to show the "i" trigger.

The user navigates pending tasks with up/down arrows. The display text for each task is:

```
Assign TXXXX: <title> — unblocks TYYYY, TZZZZ once done
```

If the task unblocks no other tasks, omit the "— unblocks ..." portion. Append "Esc to cancel" or similar to the UI.

Pressing Enter assigns the selected task. Pressing Escape exits interactive mode without assigning.

# Acceptance

- Pressing "i" enters interactive task assignment mode.
- Pending tasks are listed, sorted by task ID.
- Up/down arrows navigate the list.
- Display text follows the format: `Assign TXXXX: <title>` plus ` — unblocks <ids> once done` when applicable.
- A hint like "Esc to cancel" is shown.
- Enter assigns the selected task (same as `ravel assign <taskId>`).
- Escape exits without assigning.
- The CommandInput hint is updated to include "i" as an available action.
- `npm run build` succeeds.
- `npm test` passes.

# Implementation Notes

- The TUI is in `src/tui/`. The CommandInput component likely lives in `src/tui/app.tsx` or a sibling file.
- The task list is rendered in `src/tui/` — look for how the task columns display tasks to reuse the task data.
- For determining "unblocks": a task unblocks another if the other task lists it as a dependency and that other task is not `done`. This is the inverse of the dependency graph.
- The assign action already exists (`ravel assign <taskId>`) — reuse the same underlying logic.
- Consider whether interactive mode should filter to only `new` or also include `in-progress` tasks. Start with `new` and `in-progress` (any non-`done`/non-`review` task).
