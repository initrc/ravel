# Ravel

Ravel is a small task orchestrator for interactive AI coding sessions. It keeps
plans as version-controlled Markdown, lets you choose work with `fzf`, and
hands each task to an AI agent with a task-specific review and integration
prompt.

Ravel owns task files, dependency checks, task selection, and prompt
generation. [workmux](https://github.com/raine/workmux) owns the agent command,
Git branches and worktrees, shared files, multiplexer windows, merge behavior,
and cleanup. There is no Ravel server, database, runtime state, or
configuration file.

## Requirements

Ravel v2 supports macOS and Linux and requires Node.js. Install it from npm:

```sh
npm install --global @initrc/ravel
```

[`fzf`](https://github.com/junegunn/fzf) is the only mandatory external
command. Bare `ravel` cannot open its task picker without it.

Git, tmux, and [workmux](https://github.com/raine/workmux#installation) are
recommended for the complete parallel workflow. If Git, tmux, or workmux is
unavailable, Ravel falls back to a manual prompt instead of preventing you from
working on the task.

Run the prerequisite checks at any time:

```sh
ravel doctor
```

`ravel doctor` checks `fzf` as mandatory and Git, tmux, and workmux as
recommended. A missing recommended tool is reported but does not make the
command fail.

## Quick start

Initialize Ravel in the root of a repository:

```sh
cd your-project
ravel init
```

This creates `ravel/docs/` and `ravel/tasks/`, installs
`ravel/docs/ravel-conventions.md` if it does not exist, and creates or updates
only the `## Ravel Conventions` section of `AGENTS.md`. Re-running the command
is safe: it preserves an existing conventions file and all unrelated
`AGENTS.md` content.

Create tasks by asking your AI agent, for example:

```txt
Create a Ravel task for each of the following:
- Add dark mode to settings
- Fix pagination's off-by-one error
```

The generated `AGENTS.md` instructions point the agent to the task format and
naming rules. Tasks are Markdown files with YAML frontmatter:

```md
---
id: T0001
title: Add dark mode
status: new
dependencies: []
---

# Scope

- Add a dark mode setting.

# Acceptance

- The setting persists between launches.

# Implementation Notes

- Start with the settings module.
```

Then launch the picker:

```sh
ravel
```

## Configure workmux

Ravel delegates the full worktree lifecycle to workmux. Follow the
[workmux documentation](https://github.com/raine/workmux#configuration) for
installation and configuration details. This is the minimal configuration for
direct prompt delivery to Codex:

```yaml
agent: codex
base_branch: auto
panes:
  - command: <agent>
    focus: true
```

Choose any agent supported by workmux. The `agent` value controls what
`<agent>` launches, `base_branch: auto` starts each task from workmux's
effective main branch, and the agent pane receives Ravel's generated prompt
directly.

Keep workmux-specific choices in its global or project configuration. Workmux
owns agent commands, base and merge branch behavior, worktree paths, copied or
symlinked files, setup hooks, pane and window layouts, merging, and cleanup.
Ravel neither reads nor writes workmux configuration.

### Notification ownership

Ravel does not emit a system notification when a task becomes ready for
review. The agent reports readiness and ends its turn, so any turn-completion
notification belongs to the configured agent. Ravel does not install or
require workmux agent-status hooks or tmux status icons.

After approval and a successful merge, the retained
`workmux merge --rebase --notification` command lets workmux send its native
merge notification. That notification is independent of the agent's
turn-completion behavior.

## The task picker

Bare `ravel` searches upward from the current directory for `ravel/tasks/`.
When Git is available, it reads `git worktree list --porcelain -z`, loads the
primary worktree's tasks as the authoritative collection, and finds each
task's live state from the registered worktree whose branch exactly matches
the task filename. This works with custom worktree locations because Ravel
uses Git's registered absolute paths rather than guessing a directory.

The `fzf` picker shows every task that is not yet `done` in the primary
worktree, grouped in this order:

```txt
merge-ready   T0001  Approved but not integrated
review-ready  T0002  Waiting for human review
in-progress   T0003  Agent is implementing
new           T0004  Ready to start
blocked       T0005  Waiting for dependencies
```

The preview displays the complete live task file. Enter selects a task and
Escape cancels without launching anything. `blocked` is derived from
incomplete dependencies and cannot be selected for implementation.

The two readiness states are also derived rather than stored:

- `review-ready` means the matching worktree's task is in `review` while the
  primary task remains open.
- `merge-ready` means the matching worktree's task is `done` but that approved
  commit has not reached the primary worktree. It also keeps interrupted
  rebase, verification, or merge work visible.

Selecting a `new`, `in-progress`, or `review-ready` task with Git, tmux, and
workmux available runs the equivalent of:

```txt
workmux add <task-branch> --open-if-exists --prompt <generated-prompt>
```

Workmux creates or reopens the worktree and injects the prompt directly into
the configured agent pane. Ravel does not also copy the prompt on this
successful path. Selecting `merge-ready` reopens the registered worktree
without generating a duplicate implementation prompt.

## Review and integration workflow

The generated prompt is the source of the task-specific lifecycle
instructions. Before approval, the agent:

1. Moves a new task to `in-progress` before implementation.
2. Implements only that task and runs its required verification.
3. Moves the task to `review` when it is ready for a human.
4. Reports that the task is ready for review and stops without committing.
5. Waits for the user to say `LGTM` explicitly.

After explicit `LGTM`, the workmux prompt tells the agent to:

1. Set the task to `done` and create exactly one task commit.
2. Run `workmux rebase`, resolve any conflicts, and verify the rebased result.
3. Only after verification succeeds, run
   `workmux merge --rebase --notification`.
4. If a newer merge-time conflict occurs, resolve it, verify again, and retry
   the same workmux merge command.

The separate rebase prevents a conflict-free merge from integrating and
cleaning up the worktree before the rebased result has been tested. Workmux
resolves the saved base and merge target, performs the merge, sends its native
successful-merge notification, and cleans up its resources. The generated
prompt explicitly marks these two post-`LGTM` workmux commands as narrow,
task-specific exceptions to the general Ravel prohibitions on agent-owned
merge and deletion. Direct Git push, merge, rebase, worktree removal, and
branch deletion remain prohibited.

## Manual prompt fallback

If Git, tmux, or workmux is unavailable—or workmux launch fails—Ravel switches
to the manual prompt variant. It reports the unavailable tools, copies the
full prompt to the clipboard, and also prints it so clipboard failure cannot
lose the instructions. Clipboard writing is used only for this manual/error
fallback.

Open an AI agent in the checkout where you want to work and paste the prompt.
Ravel does not create a branch, change directories, update task status, or
start an agent in manual mode. The same review gate applies, but after `LGTM`
the manual prompt stops after the single approved commit and leaves rebase,
merge, and cleanup to you.

For a `merge-ready` task without workmux, Ravel prints its registered branch
and worktree path so you can resume integration manually; it does not copy a
new prompt.

## Commands

| Command | What it does |
| --- | --- |
| `ravel` | Check `fzf`, discover live task states, and open the picker |
| `ravel init` | Install or refresh the repository-local Ravel structure |
| `ravel doctor` | Check mandatory and recommended prerequisites |
| `ravel --help` | Show command help |
| `ravel --version` | Show the installed package version |

## Migrating from v1

Remove the `.ravel/` directory.

That is the complete migration. Committed files under `ravel/` remain valid,
and an existing Ravel `## Ravel Conventions` section in `AGENTS.md` remains
valid. Ravel v2 neither reads nor recreates `.ravel/`.
