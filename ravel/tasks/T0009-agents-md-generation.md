---
id: T0009
title: AGENTS.md generation with Ravel conventions
status: done
dependencies:
  - T0001
---

# Scope

- During `ravel init`, create or update `AGENTS.md` with Ravel conventions.
- Include instruction for agents to read `ravel/docs/ravel-conventions.md` before modifying tasks or docs.
- Create `ravel/docs/ravel-conventions.md` with the task format specification.
- Preserve existing AGENTS.md content if already present (append, don't overwrite).

# Acceptance

- `ravel init` generates AGENTS.md if it doesn't exist.
- `ravel init` appends Ravel section to existing AGENTS.md if present.
- `ravel/docs/ravel-conventions.md` contains the task format spec and valid statuses.
- Generated AGENTS.md references the conventions file path correctly.

# Implementation Notes

- The AGENTS.md template and ravel-conventions.md template both ship as built-in files in the package's `templates/` directory (see T0001).
- T0001 copies the conventions file; this task handles the AGENTS.md generation logic.

## Section detection and update

When `ravel init` runs, after creating directories (T0001), it calls the AGENTS.md generator:

1. Read existing `AGENTS.md` (if it exists in project root).
2. Look for a line matching `## Ravel Conventions` (case-insensitive, but generate with title case).
3. If found: replace that section (from `## Ravel Conventions` through to the next `## ` heading or EOF) with the fresh template section.
4. If not found and AGENTS.md exists: append the section at the end of the file with a blank line separator.
5. If AGENTS.md doesn't exist: write the full template content (which includes both the Ravel section and any other boilerplate).

## Ravel Conventions section template

```md
## Ravel Conventions

Before creating or modifying any design docs or tasks, read:

```txt
ravel/docs/ravel-conventions.md
```

Follow those conventions strictly.
```

The AGENTS.md generation should use `fs.readFileSync` / `fs.writeFileSync` and simple string operations — no template engine needed.

## ravel-conventions.md template content

Ship a `templates/ravel-conventions.md` with:

```md
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
```

This file is copied by T0001's init logic, but the template content is defined here.
