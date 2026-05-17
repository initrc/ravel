# Ravel v1 Design

## Overview

Ravel is a local-first orchestration tool for interactive AI coding sessions.

Ravel coordinates markdown task files, git worktrees, and interactive coding agents (e.g., Claude Code, Codex) to enable structured parallel software development.

Ravel is intentionally **not** a headless autonomous agent system in v1.

Instead, it acts as:

- A terminal control room for task tracking
- A launcher for interactive Builder sessions
- A coordinator for git worktrees and integration
- A lightweight orchestrator using filesystem state

The user remains in the loop and reviews code directly within the interactive agent session.

## Goals

- Local-first and repository-local
- No GitHub dependency
- Works with any git remote or local repo
- Support interactive Builder sessions instead of expensive headless agents
- Coordinate multiple concurrent Builders safely using git worktrees
- Enable dependency-aware task execution
- Be simple enough to implement and iterate quickly

## Non-goals (v1)

- Autonomous PR creation/review
- GitHub-specific workflows
- Long-running background daemon
- Database-backed orchestration
- Multi-user collaboration
- Automatic Architect launching
- Agent memory persistence across sessions
- Automatic conflict resolution
- Task archival UI

---

# Concepts

## Builder

A Builder is an interactive coding agent session.

Examples:

- Claude Code
- Codex CLI
- Custom user command

Ravel does not manage model selection.

The user configures the Builder harness themselves.

Ravel only launches the configured command.

## Architect

Architect is a conceptual role, not a runtime system role in v1.

Users may use any AI system manually to:

- Write design docs
- Break down tasks
- Refine technical decisions

Ravel only enforces conventions around file locations and task format.

## Design Docs

Design docs define technical architecture and implementation plans.

Location:

```txt
ravel/docs/
```

Example:

```txt
ravel/docs/design-v1.md
```

Design docs are authored manually or with external AI tools.

## Tasks

Tasks are markdown files with YAML frontmatter.

Location:

```txt
ravel/tasks/
```

Naming convention:

```txt
T0003-apply-shadcn-ui-primitives.md
```

Task IDs are zero-padded:

```txt
T0001
T0002
T0100
T1000
```

Tasks are the source of truth for project execution.

---

# Folder Structure

```txt
project-root/
├── ravel/
│   ├── docs/
│   │   └── design-v1.md
│   └── tasks/
│       ├── T0001-example-task.md
│       └── T0002-example-task.md
│
├── .ravel/
│   ├── config.json
│   ├── sessions/
│   │   └── T0003.json
│   └── logs/
│
└── .worktrees/
    └── T0003/
```

### `ravel/`

Committed project planning artifacts.

Should be committed to git.

### `.ravel/`

Local runtime state.

Should be gitignored.

### `.worktrees/`

Generated git worktrees.

Should be gitignored.

Recommended `.gitignore`:

```txt
.ravel/
.worktrees/
```

---

# Task Format

Tasks use Markdown with YAML frontmatter.
The filename is a combination of task id and kabab-case title, e.g., T0003-apply-shadcn-ui-primitives.md.

Example:

```md
---
id: T0003
title: Apply shadcn ui primitives
status: new
dependencies:
  - T0002
---

# Scope

- Initialize shadcn/ui for the Next.js app.

# Acceptance

- `components.json` points to Tailwind CSS and path aliases.
- Home page uses shadcn components.

# Implementation Notes

- Use default shadcn CLI setup.
```

## Valid Statuses

Only these statuses are valid:

```txt
new
in-progress
review
done
```

### Computed Blocked State

Blocked is not persisted.

Blocked means:

```txt
status = new
AND
at least one dependency is not done
```

---

# CLI

## `ravel init`

Creates required folders.

```txt
ravel/
  docs/
  tasks/

.ravel/
  sessions/
  logs/
  config.json
```

Also creates or updates:

```txt
AGENTS.md
```

with Ravel conventions.

````md
## Ravel Conventions

Before creating or modifying any design docs or tasks, read:

```txt
ravel/docs/ravel-conventions.md
```

Follow those conventions strictly.
````

Ravel ships a built-in `ravel-conventions.md` that documents the task format, valid statuses, naming conventions, and blocked computation rules. During `ravel init`, this file is copied to `ravel/docs/ravel-conventions.md` so the AGENTS.md reference resolves correctly.

If other commands are executed without initialization:

```txt
This does not look like a Ravel project.

Run:
  ravel init
```

## `ravel`

Launches the interactive terminal UI.

Responsibilities:

- Watch tasks and docs
- Show task dashboard
- Show logs
- Accept slash commands

### Layout

Top section:

```txt
New | In Progress | Review | Blocked
```

No Done column in v1.

Done tasks disappear from the dashboard.

Middle section:

Event logs.

Examples:

```txt
T0003 is in progress
T0003 is ready for review
T0004 is created
design-v1.md is created
```

Bottom section:

Slash command input.

Examples:

```txt
/assign
/config
/help
```

## `ravel assign T0003`

Runs in a separate terminal.

Responsibilities:

1. Validate project
2. Validate task
3. Validate dependency state
4. Create git branch
5. Create git worktree
6. Update task status to `in-progress` — in the worktree copy, not on the main branch. This keeps the main branch clean during active development.
7. Generate Builder prompt
8. Generate launch command (cd + ravel prompt --copy + builder)
9. Optionally copy launch command to clipboard
10. Register runtime session

### Branch Naming

Derived from filename:

```txt
T0003-apply-shadcn-ui-primitives
```

### Worktree Path

```txt
.worktrees/T0003
```

### Session File

Example:

```json
{
  "taskId": "T0003",
  "branch": "T0003-apply-shadcn-ui-primitives",
  "worktreePath": ".worktrees/T0003"
}
```

Location:

```txt
.ravel/sessions/T0003.json
```

---

# Launch Command

`ravel assign` generates a launch command and optionally copies it to clipboard. The user pastes it in a new terminal to begin working.

Launch command format:

```
ravel prompt T0003 --copy && cd .worktrees/T0003 && claude
```

Three parts:
1. `ravel prompt T0003 --copy` — prints the builder prompt and copies it to clipboard (no interactive menu)
2. `cd .worktrees/T0003` — navigates to the worktree
3. `claude` — launches the configured Builder

When the Builder launches, the prompt is already in clipboard — the user just pastes it.

If `ravel` is not on PATH, the absolute path to `ravel.js` is used instead.

## Builder Prompt

The prompt is generated from this template:

```txt
You are working in a git worktree for task T0003.

Implement the task described in:
ravel/tasks/T0003-apply-shadcn-ui-primitives.md

When the implementation is ready for human review:
- update the task status to review
- stop and wait for my feedback

If I later say LGTM:
- update the task status to done
- create exactly one local git commit
- use this commit message format:
  T0003: Apply shadcn ui primitives

Do not push, merge, rebase, or delete branches.
```

The task file path and git commit message are interpolated from the assigned task.

## Clipboard

The interactive `ravel prompt` command shows a clipboard menu:

```txt
1. Copy
2. Always copy
Esc. Do not copy
```

Option 2 sets `copyCommandByDefault` to `true` in `.ravel/config.json`, skipping the menu on future assignments. The `--copy` flag skips the menu entirely for non-interactive use in the launch command.

---

# File Watching

Ravel uses filesystem watching as shared state.

No daemon or IPC is required.

Ravel watches:

```txt
ravel/tasks/*.md
ravel/docs/*.md
.ravel/sessions/*.json
```

When a new session file appears:

```txt
.ravel/sessions/T0003.json
```

Ravel dynamically starts watching:

```txt
.worktrees/T0003/ravel/tasks/*.md
```

This allows the main TUI to observe Builder status changes.

### TUI status resolution

The TUI loads task statuses from the main repo's `ravel/tasks/`, then merges the worktree copy for any task with an active session. This means:

- The main branch's task file stays untouched (no uncommitted status changes).
- When a Builder changes a task to `review` or `done` in the worktree, the TUI reflects it immediately.
- When a session ends (worktree removed), the TUI falls back to the main branch's task file.

Example:

Builder changes:

```yaml
status: review
```

Ravel logs:

```txt
T0003 is ready for review
```

---

# Integration Flow

When Builder marks:

```yaml
status: done
```

Ravel performs:

1. Fetch latest main branch (remote-tracking ref `origin/main` when a remote exists; otherwise local `main`)
2. Rebase worktree branch onto the fetched target
3. Run tests (configurable `testCommand`; skipped when empty)
4. Push rebased branch to remote (skipped when `pushOnIntegration` is false or no remote exists)
5. Clean up worktree and branch
6. Remove session file
7. Update task status to `done` on the main branch (so dependent tasks become assignable)
8. Sync local main branch via `git pull --ff-only` to keep the working directory up to date

### Remote vs local-only repos

Ravel works with or without a git remote:

- **Remote exists**: fetches `origin/main`, rebases onto `origin/main`, pushes the task branch.
- **No remote**: skips fetch and push, rebases directly onto the local `main` branch.

### Rebase Conflicts

If rebase conflicts occur:

- Rebase is aborted to restore state.
- Ravel logs the conflict and pauses.
- User resolves conflicts manually in the worktree.
- User re-triggers integration with `ravel integrate <taskId>`.

Builder owns code changes.

Ravel owns integration.

---

# Configuration

Stored in:

```txt
.ravel/config.json
```

Example:

```json
{
  "builderCommand": "claude",
  "copyCommandByDefault": false,
  "maxConcurrentBuilders": 2,
  "mainBranch": "main",
  "testCommand": "npm test",
  "pushOnIntegration": true
}
```

`testCommand` may be set to `""` to skip tests during integration.

`pushOnIntegration` may be set to `false` to skip the push step.

`mainBranch` sets the branch to rebase onto (defaults to `main`).

Ravel does not configure Builder models.

Users configure model selection inside the Builder harness.

---

# Recommended Tech Stack

## Language

TypeScript (ESM, `"type": "module"`)

Reasons:

- npm global install
- Strong ecosystem
- Cross-platform subprocess management
- Shared code with React/Next.js if web UI is added later

## CLI + TUI

Recommended:

- Ink

Alternative:

- Blessed / Neo-blessed

## CLI Commands

Recommended:

- Commander

## File Watching

Recommended:

- chokidar

## Process Management

Recommended:

- execa

## Git Integration

Recommended:

- simple-git

Native git CLI may also be used for worktree operations.

## Frontmatter Parsing

Recommended:

- gray-matter

## Clipboard

Recommended:

- clipboardy

## Schema Validation

Recommended:

- zod

---

# v2 Ideas

- Task archival (`ravel archive`)
- Web dashboard
- Auto assignment
- Better Builder templates
- Conflict UI
- Rich task filtering
- Metrics and history
- Terminal integrations
- Multi-repo support
- Git provider integrations

---

# Design Principles

1. Local-first
2. Human-in-the-loop
3. Markdown as source of truth
4. Filesystem over daemon
5. Git-native workflows
6. Simple conventions over configuration
7. Interactive Builders over expensive headless agents
8. Keep v1 intentionally small
