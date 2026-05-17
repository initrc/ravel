---
id: T0014
title: Isolate task status updates per session
status: done
dependencies: []
---

# Scope

- When multiple sessions work on different tasks in parallel, each session must only update the status of its own task.
- Prevent a session from changing another task's status (e.g., from `review` to `in-progress`) when it updates its own task.

# Acceptance

- A session working on T0001 cannot change T0002's status in its task file.
- Parallel task sessions can safely update their own task statuses without cross-contamination.
- The status of a task in `review` is never accidentally reverted to `in-progress` by a different session.

# Implementation Notes

- Investigate how status updates are currently written (direct file write, full task list rewrite, etc.).
- The fix may involve per-task file writes instead of bulk updates, or filtering by task ID before writing.
- The `assign` command likely sets a session-level task ID that can be used to scope writes.
