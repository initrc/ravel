# Ravel v2 Design

## Overview

Ravel v2 is a local task picker and launcher for interactive AI coding sessions.

It keeps Ravel's repository-local Markdown tasks, dependency parsing, Git
worktree isolation, and human review workflow. It replaces the custom Ink TUI,
command suite, file watcher, session registry, integration engine, and
notification system with a single `fzf`-based workflow.

The user runs `ravel`, selects an open task, and receives an isolated agent
session in that task's worktree. The agent owns implementation and local
integration after explicit approval. The user owns worktree cleanup.

Ravel v2 remains published as the `@initrc/ravel` npm package.

## Goals

- Make bare `ravel` the complete user-facing workflow.
- Use `fzf` for task filtering, selection, and preview.
- Preserve safe parallel work through one Git worktree per task.
- Launch or resume task sessions in tmux when invoked inside tmux.
- Remain useful outside tmux by launching the agent in the current terminal.
- Keep committed task files as the source of truth for integration and
  dependencies.
- Leave rebasing, merging, and conflict resolution to the interactive agent.
- Leave worktree and branch deletion to the user.
- Remove runtime machinery that is not required by this workflow.

## Non-goals

- Backwards compatibility with v1 commands, configuration, or runtime state.
- Automatic integration, stashing, conflict resolution, or cleanup.
- Background file watching or notifications.
- Headless agent execution.
- Agent model or permission configuration.
- Global project discovery outside the current Git repository.
- Windows support in v2.

## Version Preservation

Before v2 implementation changes begin:

1. Create branch `v1` at the existing `v1.0.3` tag.
2. Push `v1` to `origin`.
3. Treat `v1` as a frozen snapshot; do not develop on it.
4. Continue v2 development on `main` and release it as `2.0.0`.

The existing `v1.0.3` tag remains unchanged.

## Requirements

Ravel v2 supports macOS and Linux and requires:

- Node.js
- Git with worktree support
- `fzf`

tmux is optional. Clipboard support continues through `clipboardy`.

If a required executable is missing, Ravel exits before making changes and
names the missing prerequisite.

## Repository Layout

```txt
project-root/
├── ravel/
│   ├── docs/
│   │   └── ravel-conventions.md
│   └── tasks/
│       └── T0001-example-task.md
├── .ravel/
│   └── config.json
└── .worktrees/
    └── T0001/
```

`ravel/` contains committed planning artifacts. `.ravel/` contains only local
configuration. `.worktrees/` contains linked worktrees. Both `.ravel/` and
`.worktrees/` are gitignored.

There are no `.ravel/sessions/` or `.ravel/logs/` directories in v2. Git's
worktree registry and tmux window metadata provide the runtime state Ravel
needs.

## Configuration

`.ravel/config.json` has a schema marker and two user settings:

```json
{
  "configVersion": 2,
  "agentCommand": "codex",
  "baseBranch": "main"
}
```

### `configVersion`

- Identifies the configuration schema, not the installed package version.
- Is written as `2` by Ravel v2.
- Allows later releases to distinguish compatible configuration from a schema
  that requires an explicit migration.
- Is not changed for ordinary package releases that keep the same schema.

### `agentCommand`

- A shell command launches the user's interactive coding agent.
- `null` enables copy-only mode.
- The value is trusted local configuration and may include arguments.

### `baseBranch`

- Names the local branch from which task branches are created and into which
  approved work is fast-forwarded.
- Initialization defaults it to the branch checked out in the primary
  worktree.
- It must name an existing local branch.
- Ravel never fetches a remote branch to update it.

The v1 settings `copyCommandByDefault`, `mainBranch`, `testCommand`, and
`notifyWhenDone` are removed. There is no config UI. Users may edit the JSON
file directly.

### Migrating from v1

V1 configuration has no version marker. Ravel detects it structurally when a
config lacks `configVersion` and contains v1-only fields such as `mainBranch`,
`testCommand`, or `notifyWhenDone`.

Ravel does not mutate a v1 project automatically. It prints the migration
steps and exits:

```txt
Ravel v1 configuration detected.

To migrate this project to Ravel v2:
1. Remove the .ravel/ directory.
2. Remove only the "## Ravel Conventions" section from AGENTS.md.
3. Remove ravel/docs/ravel-conventions.md so v2 can install its new conventions.
4. Run ravel again and confirm initialization.

See the "Migrating from v1" section in README.md for details.
```

The README migration section must include the same steps, explain that
`.ravel/` contains only v1 local runtime state and configuration, and warn the
user not to delete `.worktrees/`. Existing registered worktrees and their
branches remain discoverable by v2 after initialization.

If `configVersion` is present but unsupported, Ravel reports the version and
exits without changing files. It must not treat unknown schemas as v1.

## Entrypoint and Initialization

The public interface is:

```txt
ravel
ravel --help
ravel --version
```

There are no public subcommands.

Ravel accepts invocation from any directory inside the primary checkout or
one of its linked worktrees. It uses Git's common directory and worktree
registry to resolve the primary project root. Invocation outside a Git
repository exits with a clear error.

Ravel checks for a v1-shaped or unsupported config before normal
initialization. When `.ravel/config.json` is missing, bare `ravel` asks for
confirmation before initializing. Initialization:

1. Creates `ravel/docs/`, `ravel/tasks/`, and `.ravel/` when missing.
2. Installs `ravel/docs/ravel-conventions.md` when missing.
3. Creates or updates the Ravel section of `AGENTS.md`.
4. Adds `.ravel/` and `.worktrees/` to `.gitignore` when missing.
5. Detects the primary worktree's current branch for `baseBranch`.
6. Offers installed known agents, copy-only mode, and a custom command.
7. Writes the minimal v2 config with `configVersion: 2` and continues into the
   picker.

Initialization does not overwrite an existing conventions file or unrelated
content in `AGENTS.md` or `.gitignore`. If there are no open tasks after
initialization, Ravel prints that fact instead of opening an empty picker.

## Task Model

The committed task schema and statuses remain unchanged:

```yaml
id: T0001
title: Example task
status: new
dependencies: []
```

Persisted statuses are `new`, `in-progress`, `review`, and `done`. `blocked`
remains computed and is never written to a task file.

### Two status views

Ravel distinguishes integration state from live worktree state:

- The task committed on `baseBranch` determines whether work is integrated and
  whether dependencies are satisfied.
- The matching task branch or worktree copy determines the active task's live
  display state.

This distinction prevents a dependency from becoming runnable merely because
its prerequisite is marked `done` on an unmerged branch.

Although all four values are valid in a task file, the Ravel-managed workflow
writes only `new` and `done` in the primary checkout. `in-progress` and
`review` exist only on the task branch. In the following tables, an em dash in
the Worktree column means that no task worktree or unmerged task branch exists;
it is not a task status.

### V1 status resolution

V1 first loads the main task objects, then mutates them with the matching
worktree status when an active session JSON file exists. The TUI columns use
that resulting status.

| Main   | Worktree      | V1 UI              |
|--------|---------------|--------------------|
| `new`  | —             | `new` or `blocked` |
| `new`  | `in-progress` | `in-progress`      |
| `new`  | `review`      | `review`           |
| `new`  | `done`        | hidden             |
| `done` | `done`        | hidden             |
| `done` | —             | hidden             |

V1 assignment creates the worktree and immediately writes `in-progress` there
before returning the launch command to the user. The agent does not set that
status. This deliberately makes the assigned task visible during the gap in
which the user must paste the command into another terminal and launch the
agent. The agent later writes `review` and `done` in the worktree. Integration
fast-forwards the `done` task onto main, removes the worktree, and leaves the
main copy as `done`.

For a resulting `new` status, v1 computes `blocked` from the same mutated task
collection. A dependency marked `done` only in its worktree therefore makes a
dependent task appear unblocked and selectable in the TUI before integration.
The subsequent `assignCommand` reloads tasks from main without the overlays and
rejects that selection as blocked. A resulting `done` status has no dashboard
column and is hidden while the TUI starts automatic integration.

### V2 status resolution

V2 makes committed main state authoritative for integration. Main `done`
always hides the task, even if a completed worktree still exists. When main is
`new`, active worktree or branch state supplies the live UI status. A primary
task committed as `in-progress` or `review` is invalid Ravel-managed state;
Ravel reports it instead of inventing another lifecycle path.

| Main   | Worktree      | V2 UI              |
|--------|---------------|--------------------|
| `new`  | —             | `new` or `blocked` |
| `new`  | `in-progress` | `in-progress`      |
| `new`  | `review`      | `review`           |
| `new`  | `done`        | `done (unmerged)`  |
| `done` | `done`        | hidden             |
| `done` | —             | hidden             |

V2 retains the useful v1 assignment behavior but removes the launch gap:
after creating the worktree, Ravel writes `in-progress`, copies the prompt,
and directly launches the agent in a new tmux window or the current terminal.
The user only needs to paste the prompt into the running agent.

V2 differs from v1 in three ways:

- Worktree `done` remains visible as `done (unmerged)` until main is updated.
- Both UI display and launch validation use committed main statuses for
  dependencies, eliminating v1's appear-assignable-then-reject mismatch.
- V1 uses `.ravel/sessions/T0001.json` to map a task to a worktree path, then
  keeps the TUI current by watching the main and worktree task files. V2 has no
  runtime mapping or watcher: each `ravel` invocation queries
  `git worktree list --porcelain`, matches the task's derived branch, and reads
  the relevant task frontmatter once when building the picker.

Git does not contain a separate Ravel status. Task frontmatter remains the
status store in both versions. In v2, Git supplies the registered worktree
location, branch relationship, and committed `baseBranch` copy used to decide
whether work is integrated and dependencies are satisfied. The active
worktree or task-branch copy supplies the live display status. Because the
picker is a fresh scan rather than a watched dashboard, changes made while it
is open appear the next time the user runs `ravel`.

A task is shown as `blocked` only when main is `new`, there is no active task
branch/worktree, and one or more dependencies are not committed as `done` on
`baseBranch`. Missing dependency references remain validation errors. A
registered task branch whose task status has not advanced to `in-progress` is
invalid partial assignment state; Ravel reports it instead of treating it as a
normal picker state.

Ravel enumerates task files from the primary checkout so newly authored files
remain visible. A dirty or untracked task is marked in the picker, but it
cannot be launched until its file is committed and identical on `baseBranch`.
This avoids creating a worktree with a missing or older task description.

## Git State Discovery

Ravel does not create session JSON. For every task it derives:

- Branch: the task filename without `.md`, for example
  `T0001-example-task`.
- Canonical worktree path: `.worktrees/T0001`.

`git worktree list --porcelain` is authoritative for registered worktree
locations. When the task branch is checked out in a registered worktree,
Ravel reads the task copy there. When the branch exists without a worktree,
Ravel may read its task status from the branch and reattach it at the canonical
path when selected.

Ravel must not silently replace ambiguous or unsafe Git state:

- A canonical directory that is not a registered worktree is an error.
- A task branch checked out in another registered path uses that path.
- A branch or worktree that cannot be mapped unambiguously to the task is an
  error with recovery guidance.
- Ravel never force-removes a worktree or force-deletes a branch.

## fzf Interface

Bare `ravel` starts one `fzf` process populated with every task not committed
as `done` on `baseBranch`.

Each row displays:

```txt
STATUS            TASK ID   TITLE
review            T0007     Add task picker
in-progress       T0008     Add tmux launcher
new               T0009     Rewrite README
blocked           T0010     Publish v2
```

Rows are ordered by state and passed with `--no-sort` so filtering preserves
the groups:

1. `done (unmerged)`
2. `review`
3. `in-progress`
4. `new`
5. `blocked`

The status prefix is repeated on every row instead of inserting selectable
section-header rows. Search matches status, task ID, and title.

The preview pane shows the complete applicable task file: the active worktree
copy when present, otherwise the primary checkout copy. Ravel passes the file
path as hidden selection data and quotes it safely in the preview command.

The header explains:

- Enter launches or resumes a task.
- Escape exits without making changes and therefore serves as a status-only
  check.

Selecting a blocked task does not create Git or tmux state. Ravel exits with a
message listing the incomplete dependencies.

## Starting a New Task

Before mutation, Ravel validates that:

- The task is not blocked.
- Its task file is committed and unchanged on `baseBranch`.
- `baseBranch` exists.
- No conflicting branch, worktree registration, or filesystem path exists.

Ravel then:

1. Creates the branch and worktree atomically from `baseBranch`:

   ```txt
   git worktree add -b T0001-example-task .worktrees/T0001 main
   ```

2. Updates only the worktree task copy to `in-progress`.
3. Generates and copies the agent prompt without asking a second clipboard
   question.
4. Launches the configured agent or copy-only shell behavior.

The task file in the primary checkout remains untouched. If worktree creation
or the status update fails, Ravel cleans up only the branch/worktree created by
that failed operation; it never removes pre-existing state.

## Resuming a Task

Selecting `in-progress`, `review`, or `done (unmerged)` resumes existing work
instead of assigning it again.

Inside tmux, Ravel searches the current session for a window tagged with both
the primary project root and task ID:

```txt
@ravel_project_root
@ravel_task_id
```

If found, Ravel selects that window and does not replace the clipboard. If no
tagged window exists, it recopies the prompt and creates a window in the
existing worktree. Ravel does not switch to another tmux session; the expected
model is one project per tmux session.

Outside tmux, selecting an active task launches the configured agent directly
in its existing worktree.

## tmux Launching

When `$TMUX` is set, Ravel creates a window in the current session with:

- Working directory set to the task worktree.
- Window name set to the task ID, for example `T0001`.
- Automatic renaming disabled.
- Project-root and task-ID window tags set for later resume.

Conceptually, the launch is:

```sh
tmux new-window -n "T0001" -c "/absolute/path/.worktrees/T0001" "codex"
```

If `agentCommand` is `null`, the new window opens the user's shell in the
worktree, prints the generated prompt and copy confirmation, and leaves the
prompt on the clipboard.

Ravel invokes ordinary `fzf`; it does not request fzf's tmux popup mode. Users
who want a popup bind Ravel through tmux:

```tmux
bind-key r display-popup -E -w 90% -h 85% -d '#{pane_current_path}' 'ravel'
```

Because Ravel resolves the primary checkout through Git, this binding works
from any pane directory inside the project or one of its worktrees.

## Non-tmux Launching

When `$TMUX` is absent and `agentCommand` is configured, Ravel starts the
command as an interactive child process with:

- `cwd` set to the worktree.
- stdin, stdout, and stderr inherited from the current terminal.

Ravel waits for the agent to exit, then returns control to the invoking shell.
It cannot and does not change the parent shell's directory.

In copy-only mode, Ravel prints the full prompt, confirms that it was copied,
and prints the exact quoted `cd` command for the worktree.

## Agent Prompt and Review Flow

The prompt names:

- Task ID and task file.
- Task branch and worktree context.
- Absolute primary checkout path.
- Configured `baseBranch`.

It instructs the agent to follow this lifecycle.

### Before approval

1. Implement only the selected task.
2. Run the verification required by the task and repository instructions.
3. Update the worktree task status to `review`.
4. Do not commit, merge, or clean up.
5. Stop and wait for explicit `LGTM`.

### After explicit `LGTM`

1. Update the worktree task status to `done`.
2. Create exactly one local task commit using:

   ```txt
   T0001: Example task
   ```

3. Rebase the task branch on the local configured `baseBranch`.
4. Resolve rebase conflicts in the task worktree and amend the resolution into
   the single task commit.
5. Rerun the required build, lint, and test checks in the rebased worktree.
6. Verify that the primary checkout is clean and currently has `baseBranch`
   checked out.
7. Fast-forward the primary checkout to the task branch.
8. Report success and give the user the exact safe cleanup commands.

The agent must never:

- Fetch or push.
- Stash or discard changes in the primary checkout.
- Merge into a branch other than the configured `baseBranch`.
- Use a non-fast-forward merge.
- Remove the worktree or delete its branch.

If rebase, verification, or primary-checkout validation fails, the agent stops
and reports the issue. The intact task branch remains visible in Ravel. A task
whose branch status is `done` but whose base copy is not is displayed as
`done (unmerged)` so a failed integration cannot disappear from the UI.

The installed Ravel conventions and generated `AGENTS.md` guidance must match
this workflow. They continue to prohibit pushing and worktree deletion, but
permit the local rebase and fast-forward merge only after explicit `LGTM` and
when requested by the Ravel task prompt.

## Cleanup

Ravel never removes completed worktrees or branches.

After a successful merge, the agent tells the user to:

1. Exit the agent and close shells, editors, or other processes using the
   worktree.
2. Run the following from the primary checkout:

   ```sh
   git worktree remove .worktrees/T0001
   git branch -d T0001-example-task
   ```

The non-force `-d` check prevents deletion of an unmerged branch. Keeping
cleanup manual avoids invalidating a tmux pane, agent, shell, or editor whose
current directory is still inside the worktree.

There is no cleanup subcommand or fzf cleanup key in v2.

## Notifications

Ravel provides no notifications. It has no watcher or background process from
which to send them. Agent- or terminal-provided idle notifications remain
independent of Ravel and may be used inside or outside tmux when supported by
the user's environment.

## Removed v1 Surface

The v2 implementation removes:

- Ink and React TUI code.
- Slash commands and interactive assign mode.
- Public `init`, `assign`, `prompt`, `integrate`, and `cleanup` subcommands.
- Commander-based command routing.
- Chokidar file watching and event models.
- Session JSON and logs.
- Automatic rebase, test, merge, stash, and cleanup code.
- Ravel integration notifications.
- Clipboard-choice state and all obsolete config fields.

The implementation retains and simplifies:

- Task filename and frontmatter parsing.
- Task status validation.
- Dependency validation and blocked-state computation.
- Prompt generation and clipboard writing.
- Git command execution needed for discovery and worktree creation.

Expected runtime dependencies are `clipboardy`, `gray-matter`, and `zod`.
`fzf`, Git, tmux, and the agent remain external executables.

## Implementation Plan

1. Freeze v1 by creating and pushing the `v1` branch at `v1.0.3`.
2. Replace the command router and v1 configuration with the bare-entrypoint and
   first-run initialization flow.
3. Keep the task parser and implement base-versus-worktree status resolution.
4. Add the `fzf` adapter and preview/selection record format.
5. Add primary-root discovery, worktree creation/recovery, and launch
   validation.
6. Add prompt generation plus tmux and direct-terminal launchers.
7. Update the conventions template, generated `AGENTS.md` guidance, README,
   package metadata, and dependencies. The README must include the v1 migration
   procedure printed by the executable.
8. Delete obsolete v1 implementation and tests, then verify the complete v2
   workflow.

Each step should remain surgical: reuse the current parser and clipboard code
where they fit, and avoid abstraction beyond the single v2 workflow.

## Test Plan

Use temporary Git repositories and fake executables so automated tests do not
require an interactive fzf, tmux server, clipboard, or installed agent.

### Initialization and discovery

- Resolve the same primary root from its root, a subdirectory, and a linked
  worktree.
- Reject invocation outside Git.
- Initialize only after confirmation and preserve unrelated existing files.
- Detect the base branch and each supported agent choice, including `null` and
  a custom command.
- Write `configVersion: 2` and accept supported v2 configuration.
- Detect a v1-shaped config, print the documented migration procedure, and
  exit without mutation.
- Reject an unknown `configVersion` without treating it as v1 or partially
  mutating the project.
- Reject a missing prerequisite without partial mutation.

### Task and picker state

- Parse every valid status and reject malformed tasks or missing dependencies.
- Reject `in-progress` or `review` as a primary-checkout lifecycle state while
  accepting them in task branches/worktrees.
- Exclude tasks committed as `done` on `baseBranch`.
- Display worktree `in-progress` and `review` states over a base `new` task.
- Display branch `done` over base `new` as `done (unmerged)`.
- Keep dependent tasks blocked until the dependency is committed as `done` on
  `baseBranch`.
- Preserve state-group ordering during filtering and preview the correct file.
- Make Escape mutation-free and blocked selection mutation-free.

### Git lifecycle

- Reject launch of an untracked or base-divergent task file.
- Create the expected branch/worktree from `baseBranch` and update only the
  worktree status.
- Reuse a registered worktree and reattach an existing unregistered branch.
- Reject an unregistered canonical directory or ambiguous Git state without
  force cleanup.
- Clean up only state created by a failed new-task operation.

### Launching and prompt

- Inside tmux, create and tag the correctly named window at the worktree path.
- Resume a tagged window without rewriting the clipboard.
- Relaunch a missing window and recopy the prompt.
- Outside tmux, inherit terminal streams and use the worktree as `cwd`.
- In copy-only mode, print the prompt, confirmation, and exact `cd` command.
- Verify that the prompt contains the review gate, conservative integration
  preconditions, failure behavior, and manual cleanup instructions.

### Acceptance

- `ravel` provides the complete documented v2 workflow with no public
  subcommands.
- README migration instructions match the v1-detection output and preserve
  existing `.worktrees/`.
- Parallel task agents operate in separate worktrees.
- No Ravel action automatically merges, stashes, pushes, deletes user state,
  or removes a completed worktree.
- The package builds successfully.
- `npm run lint` passes.
- `npm test` passes in full.

