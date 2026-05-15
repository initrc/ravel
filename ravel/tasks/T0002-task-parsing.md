---
id: T0002
title: Task file parsing and validation
status: done
dependencies: []
---

# Scope

- Read and parse task markdown files from `ravel/tasks/`.
- Extract YAML frontmatter (id, title, status, dependencies) using gray-matter.
- Validate frontmatter against the schema using zod.
- Compute blocked state: `status = new AND at least one dependency is not done`.
- Load all tasks and resolve dependency graphs.

# Acceptance

- Tasks are parsed with correct id, title, status, and dependencies.
- Invalid statuses are rejected (only `new`, `in-progress`, `review`, `done` are valid).
- Blocked tasks are correctly identified based on dependency status.
- Missing or malformed frontmatter produces clear errors.
- Tasks can be loaded as a collection with dependency resolution.

# Implementation Notes

- Valid statuses: `new`, `in-progress`, `review`, `done`.
- Blocked is computed, never persisted. It is always derived: `status === "new" && dependencies.some(depId => depTask.status !== "done")`.
- Task filename format: `T0003-apply-shadcn-ui-primitives.md` (ID prefix + kebab-case slug).
- Use zod for schema validation, gray-matter for frontmatter parsing.

## Zod schema

```ts
import { z } from "zod";

const TaskFrontmatterSchema = z.object({
  id: z.string().regex(/^T\d{4}$/, "Task ID must be T followed by 4 digits"),
  title: z.string().min(1),
  status: z.enum(["new", "in-progress", "review", "done"]),
  dependencies: z.array(z.string()).default([]),
});

type TaskFrontmatter = z.infer<typeof TaskFrontmatterSchema>;
```

## Task type (parsed)

```ts
interface Task {
  id: string;            // e.g. "T0003"
  title: string;
  status: "new" | "in-progress" | "review" | "done";
  dependencies: string[];
  filename: string;      // e.g. "T0003-apply-shadcn-ui-primitives.md"
  filePath: string;      // absolute path to the task file
  body: string;          // markdown body below frontmatter
}
```

## TaskCollection

Create a `TaskCollection` class that loads all tasks from `ravel/tasks/`:

```ts
class TaskCollection {
  tasks: Map<string, Task>;  // keyed by task id
  static load(tasksDir: string): TaskCollection;
  get(id: string): Task | undefined;
  list(): Task[];
  isBlocked(task: Task): boolean;      // computed, not persisted
  getBlockedTasks(): Task[];
  getByStatus(status: string): Task[];
  getDependents(taskId: string): Task[]; // tasks that depend on this one
}
```

## Filename parsing

Extract task ID and slug from the filename:
- `T0003-apply-shadcn-ui-primitives.md` → id: `T0003`, slug: `apply-shadcn-ui-primitives`
- The id in frontmatter must match the id in the filename. Reject on mismatch.
- Derive branch name from filename by stripping `.md`: `T0003-apply-shadcn-ui-primitives`

## Updating task status

When a Builder or Ravel needs to update a task status, rewrite the file's frontmatter using gray-matter's `stringify`:

```ts
function updateTaskStatus(filePath: string, newStatus: string): void;
```

This is the mechanism both the TUI and the assign command use to change status. Gray-matter preserves the existing body content.
