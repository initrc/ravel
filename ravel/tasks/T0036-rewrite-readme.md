---
id: T0036
title: Rewrite README
status: done
dependencies: []
---

# Scope

Write a proper `README.md` at the repo root that explains what Ravel is, why it exists, how to get started, and its architecture. The README should position Ravel clearly for developers discovering the project.

# Acceptance

- README explains the name and the analogy (composer, pianist, conductor).
- README explains what makes Ravel special and why interactive sessions over fully automated orchestration.
- README includes a quickstart section: `ravel init` and the main commands (`ravel`, `ravel assign`, `ravel integrate`, `ravel prompt`).
- README describes the architecture: UNIX-y design, filesystem as database, git worktree parallelism.
- README has a placeholder for a TUI screenshot.
- README is concise — read design doc and codebase to fill gaps beyond the user's stated thoughts, but keep it tight.
- Project builds, passes lint, and all tests pass.

# Implementation Notes

## Positioning / taxonomy

Ravel sits at the intersection of two categories:

- **Project task management** (what Jira/Linear do) — but scoped narrowly to task files, dependencies, and statuses. Not full project management.
- **AI agent coordination** — launching builder sessions, integrating their work back into main.

The two halves are tightly coupled: the task management exists to feed the AI workflow, and the AI workflow is human-in-the-loop interactive sessions, not a headless auto-pipeline.

Tagline: **"A task orchestration tool for interactive AI coding."** This captures the task-management side without sounding like Jira, and the AI side without sounding like it's trying to be AutoGPT. "Orchestration" fits the musical name and the actual mechanics (dependency ordering, worktree coordination, integration).

## User's stated points to incorporate

**Name:**
- Ravel is named after French composer, pianist, and conductor Maurice Ravel. It does exactly those 3 things in analogy:
  - Composer: converts ideas into structured data — manages all tasks and docs of a project.
  - Pianist: plays its part in building the software, creating guardrails against the nondeterministic nature of AI. (May be a stretch — consider dropping.)
  - Conductor: assigns tasks to agents and integrates them back.

**What's special:**
- Manages task dependencies.
- Interactive AI agent sessions — for complex work, the model can't consistently one-shot solutions, and interactive sessions are more flexible than a headless orchestrator.
- Tasks and docs live in the repo as code. AI takes away the chore of managing them.
- Realtime dashboard and event log in the TUI.
- Interactive task assignment in the TUI, launching AI agents with prepared prompts.
- All commands also work in CLI.

**Quickstart/commands:**
- Briefly explain `ravel init` and the main commands.

**Architecture (expand on "UNIX-y"):**
- No database — everything is file-based (markdown + JSON on disk).
- Parallelizes with git worktrees.
- Read `ravel/docs/design-v1.md` for the full architecture; extract the UNIX-y aspects: each tool does one thing (init, assign, integrate, prompt are discrete CLI commands), filesystem as IPC (TUI watches files for state changes), plain-text formats, composable via shell pipes (`ravel prompt --copy && cd .worktrees/T0003 && claude`).

**Screenshot:**
- Leave a `<!-- TODO: add TUI screenshot -->` placeholder.

## Files to reference
- `ravel/docs/design-v1.md` — full design doc, architecture details.
- `src/commands/` — assign, init, integrate, prompt, config (each is a discrete CLI command).
- `src/models/` — task, session, events (plain TypeScript modules, no ORM).
- `src/tui/` — Ink-based TUI app.
- `src/watcher.ts` — chokidar-based file watcher.
- `ravel/tasks/` — existing tasks show the task format and project history.
