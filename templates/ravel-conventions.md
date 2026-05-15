# Ravel Conventions

## Task Format

Tasks are markdown files with YAML frontmatter stored in `ravel/tasks/`.

Naming: `T0001-kebab-case-title.md`

### Frontmatter

- `id`: Task ID (T0001, T0002, etc.). Must match the filename prefix.
- `title`: Short description of the task.
- `status`: One of `new`, `in-progress`, `review`, `done`.
- `dependencies`: List of task IDs that must be `done` before this task can start.

### Valid Statuses

| Status | Meaning |
|--------|---------|
| `new` | Not yet started |
| `in-progress` | Currently being worked on |
| `review` | Ready for human review |
| `done` | Completed and integrated |

### Blocked

Blocked is a computed state, never stored in frontmatter:

```
status = new AND at least one dependency is not done
```

### Body Sections

- `# Scope` — what to implement.
- `# Acceptance` — criteria for completion.
- `# Implementation Notes` — architecture decisions and guidance for the Builder.

## Design Docs

Design docs define technical architecture and are stored in `ravel/docs/`.
