# Ravel v2 Design

## Overview

Ravel v2 is a small task orchestrator for interactive AI coding sessions.

Ravel owns the repository-local task format, dependency checks, task selection,
and the task prompt. [workmux](https://github.com/raine/workmux) owns Git
worktrees, multiplexer windows, agent launching, shared files, merging, and
cleanup.

This boundary avoids duplicating workmux's lifecycle and configuration. Ravel
does not keep runtime state or configuration of its own.

Ravel v2 remains published as the `@initrc/ravel` npm package.

## Goals

- Keep Markdown tasks and design docs as the source of truth for planned work.
- Make bare `ravel` the task picker and launcher.
- Keep `ravel init` for installing the Ravel planning structure and agent
  instructions.
- Add `ravel doctor` for explicit, actionable prerequisite diagnostics.
- Use `fzf` for task filtering, selection, and preview.
- Pass a task-specific prompt to workmux when the recommended workflow is
  available.
- Remain useful without workmux or tmux by copying and printing the prompt for
  a manually opened agent.
- Preserve the existing Ravel conventions and human review gate.

## Non-goals

- Backwards compatibility with v1 commands, configuration, or runtime state.
- Managing Git branches or worktrees.
- Managing tmux windows or agent processes.
- Reimplementing workmux file copy, symlink, hook, merge, or cleanup behavior.
- Keeping `.ravel/` configuration, sessions, logs, or other runtime state.
- Configuring an agent, main branch, worktree location, or test command.
- Watching task files or displaying a live dashboard.
- Ravel-owned integration, stashing, conflict resolution, or background
  notifications.
- Headless agent execution.
- Windows support in v2.

## Version Preservation

Before v2 implementation changes began:

1. Branch `v1` was created at the existing `v1.0.3` tag.
2. The branch was pushed to `origin`.
3. `v1` became a frozen snapshot; v2 development continues on `main`.

The existing `v1.0.3` tag remains unchanged, and v2 will be released as
`2.0.0`.

## Requirements

Ravel v2 supports macOS and Linux. Node.js is required to run the package, and
`fzf` is the only mandatory external command.

Git, tmux, and workmux are recommended for the full parallel workflow. Without
any one of them, Ravel still generates and copies a prompt for manual use.

Clipboard support continues through `clipboardy`. A clipboard failure does not
lose the task prompt because Ravel also prints it in manual mode.

## Public Interface

```txt
ravel
ravel init
ravel doctor
ravel --help
ravel --version
```

There are no `assign`, `prompt`, `integrate`, or `cleanup` subcommands.

Unknown arguments or subcommands fail with a short usage message.

## Repository Layout

```txt
project-root/
└── ravel/
    ├── docs/
    │   └── ravel-conventions.md
    └── tasks/
        └── T0001-example-task.md
```

Ravel creates no ignored project-local directory. In particular, v2 never
creates `.ravel/` or `.worktrees/`. Workmux chooses and manages its own
worktree location.

## Initialization

`ravel init` operates on the current directory and is idempotent. It:

1. Creates `ravel/docs/` and `ravel/tasks/` when missing.
2. Installs `ravel/docs/ravel-conventions.md` when missing.
3. Creates or updates only the `## Ravel Conventions` section of `AGENTS.md`.

Initialization preserves an existing conventions file and unrelated
`AGENTS.md` content. It does not create configuration, edit `.gitignore`,
inspect Git, select an agent, or initialize workmux.

Bare `ravel` does not initialize implicitly. If it cannot find an initialized
Ravel project, it tells the user to run `ravel init`.

The existing conventions template and generated `AGENTS.md` section remain
valid for v2. The lifecycle-specific behavior belongs in the prompt generated
for a selected task, not in the general conventions.

## Doctor

`ravel doctor` runs a list of independent checks. Each check has:

- A stable name.
- A level: `mandatory` or `recommended`.
- A command and arguments executed without a shell.
- A result containing success or failure and the command's captured output.

Each check lives in its own module. A small runner filters checks by level,
runs them in a stable order, prints the result of every requested check, and
returns the collected results. The CLI decides the process exit code from
those results.

The initial checks are:

| Check | Command | Level | Reason |
| --- | --- | --- | --- |
| fzf | `fzf --version` | mandatory | The task picker cannot run without it. |
| Git | `git --version` | recommended | Enables registered-worktree discovery and is required by workmux. |
| tmux | `tmux -V` | recommended | Enables the intended interactive workmux window workflow. |
| tmux passthrough | `tmux show-options -gqv allow-passthrough` | recommended | Lets agent-sent terminal notifications escape tmux. |
| workmux | `workmux --version` | recommended | Enables automatic worktree and agent launching. |

A missing command and a non-zero command exit are failed checks. Successful
and failed command output is preserved so `ravel doctor` can show useful
version or error details.

The tmux passthrough check runs only when `$TMUX` is set. Outside tmux it is
reported as not applicable. Inside tmux, `all` passes; `on` is reported as a
limited warning because tmux passes sequences only from visible panes, and
`off` or an empty value fails the recommended check. Ravel prints:

```tmux
set -g allow-passthrough all
```

and the live-server equivalent:

```sh
tmux set -g allow-passthrough all
```

Ravel never edits tmux configuration. `all` is preferred over `on` because a
workmux agent often becomes ready while its pane is not visible.

`ravel doctor` runs all checks. It exits with status 1 when any mandatory
check fails and status 0 otherwise. Recommended failures are warnings and do
not change the exit status.

Bare `ravel` first uses the same doctor runner for mandatory checks only. This
fast preflight happens before task parsing or `fzf`. A mandatory failure is
printed and exits with status 1. Successful checks need not add noise to the
normal picker flow.

## Project Discovery

Bare `ravel` searches from the current directory upward for `ravel/tasks/`.
This works without Git and supplies the local project root for manual prompt
mode.

When Git is available, Ravel runs `git worktree list --porcelain -z` from that
root. The first record identifies the primary worktree, which becomes the
source of the base task collection even when Ravel was invoked from a linked
worktree. Ravel does not infer or configure a main branch; workmux remains
responsible for its base and merge branches.

## Task Model

The committed task schema and statuses remain unchanged:

```yaml
id: T0001
title: Example task
status: new
dependencies: []
```

Persisted statuses are `new`, `in-progress`, `review`, and `done`. `blocked`
is computed and is never written to a task file.

Ravel loads task definitions from the primary worktree when Git discovery is
available, or the locally discovered project otherwise. The primary copy is
authoritative for dependency completion and whether a task has been merged.
A dependency is satisfied only when its primary task status is `done`.
Missing dependency references and malformed task files are validation errors.

For each task, Ravel derives the branch name from the task filename without
`.md`. It matches that exact branch against the records from:

```txt
git worktree list --porcelain -z
```

Each record supplies an absolute `worktree` path and, for attached branches,
`branch refs/heads/<branch-name>`. When a matching registered worktree exists,
Ravel reads the corresponding task file at that path and uses its status and
file contents as the live view. This works with workmux's default sibling
directory and any custom global or project `worktree_dir`; Ravel never guesses
the path or reads workmux configuration.

The resolved picker state is:

| Primary task | Matching worktree task | Picker state |
| --- | --- | --- |
| `new` | none | `new` or `blocked` |
| `new` | `in-progress` | `in-progress` |
| `new` | `review` | `review` |
| `new` | `done` | `ready-to-merge` |
| `done` | any or none | hidden |

`ready-to-merge` is derived and is never persisted. It means the approved task
commit exists but has not yet been integrated into the primary task
collection. It also keeps interrupted rebase, verification, or merge work
visible. A missing task file in a matching registered worktree is an invalid
state reported with the branch and path. Detached and unrelated worktrees are
ignored.

## fzf Task Picker

After the mandatory preflight and task-state resolution, bare `ravel` starts
one ordinary `fzf` process populated with every task not merged as `done` in
the primary task collection.

Each row contains searchable status, task ID, and title:

```txt
ready-to-merge    T0006     Add doctor checks
review            T0007     Add task picker
in-progress       T0008     Add doctor checks
new               T0009     Rewrite README
blocked           T0010     Publish v2
```

Rows are grouped in this order and passed with `--no-sort`:

1. `ready-to-merge`
2. `review`
3. `in-progress`
4. `new`
5. `blocked`

The preview shows the complete worktree task file when one is registered for
the task branch, otherwise the primary task file. Ravel keeps the resolved
file path in hidden selection data and quotes it safely in the preview command.

The header explains that Enter selects and Escape cancels. Cancellation or an
empty selection exits successfully without copying a prompt or invoking
workmux.

Selecting a blocked task does not copy a prompt or invoke workmux. Ravel
names every incomplete dependency and exits unsuccessfully. If there are no
open tasks, Ravel reports that fact instead of starting an empty picker.

Selecting a `ready-to-merge` task does not generate or copy a new implementation
prompt. With workmux available, Ravel reopens its existing worktree window
without a prompt so the user can inspect or resume the interrupted integration.
Without workmux, Ravel prints the task branch and registered path.

## Prompt Generation

Ravel derives the workmux branch name from the task filename without `.md`,
for example `T0001-example-task`.

The generated prompt names the task ID and repository-relative task file and
instructs the agent to follow `AGENTS.md` and the task. It contains the only
v2-specific lifecycle instructions. Ravel generates a workmux variant for
automatic launch and a manual variant for clipboard fallback.

### Before approval

1. If the selected task is `new`, update its status to `in-progress` before
   implementation.
2. Implement only the selected task.
3. Run the verification required by the task and repository instructions.
4. Update the task status to `review`.
5. Send the best-effort ready-for-review notification described below.
6. Do not commit, rebase, merge, or clean up.
7. Stop and wait for explicit `LGTM`.

### After explicit `LGTM` with workmux

1. Update the task status to `done`.
2. Create exactly one local commit using:

   ```txt
   T0001: Example task
   ```

3. Run `workmux rebase` from the task worktree. Workmux reads the base branch
   saved when it created the worktree, falling back to its configured main
   branch, so the prompt does not need to know the branch name.
4. If the rebase conflicts, resolve the conflicts in the worktree and continue
   with `git rebase --continue`. Do not create an additional commit.
5. Rerun all required verification against the rebased result.
6. Run `workmux merge --rebase --notification`. The explicit strategy avoids
   a merge commit regardless of the user's workmux default and delegates the
   target branch, fast-forward merge, notification, and configured resource
   cleanup behavior to workmux.
7. If the merge-time rebase finds newer conflicts, resolve and continue the
   rebase, rerun verification, and retry the same workmux merge command.

The separate `workmux rebase` step is intentional. Calling only
`workmux merge --rebase` could immediately integrate and clean up a
conflict-free branch before the rebased result has been verified.

The prompt does not name an agent command, main branch, or worktree path.
Those are workmux concerns. These instructions are compatible with the
Ravel conventions, which require the review gate and one local commit. The
task prompt identifies `workmux rebase` and
`workmux merge --rebase --notification` as narrow, task-specific exceptions to
the general convention that agents do not merge branches or delete worktrees.
They are authorized only after explicit `LGTM`; direct push, merge, and
worktree deletion commands remain prohibited. This keeps the existing Ravel
conventions reusable without weakening their default safety rules.

### After explicit `LGTM` in manual mode

The manual prompt also requires status `done` and exactly one local commit,
but then stops and reports the completed branch to the user. It prohibits
rebase, merge, push, worktree removal, and branch deletion because workmux is
unavailable or its launch failed. The user remains responsible for integration
and cleanup in this fallback workflow.

## Ready-for-review Notification

The prompt instructs the agent to send a best-effort OSC 9 notification after
verification succeeds and the task status becomes `review`.

Outside tmux:

```sh
printf '\033]9;Ravel: T0001 ready for review\007'
```

Inside tmux:

```sh
printf '\033Ptmux;\033\033]9;Ravel: T0001 ready for review\007\033\\'
```

The agent chooses the command based on whether `$TMUX` is set. Notification
failure is non-blocking: the agent still reports that review is ready and
waits for `LGTM`. Ravel sends no notification merely because the task was
selected. The tmux form requires `allow-passthrough`; `all` also works when
the workmux pane is not visible.

## workmux Integration

After a non-blocked, non-`ready-to-merge` task is selected, Ravel probes the
recommended Git, tmux, and workmux availability checks using the same doctor
modules.

When all three availability checks pass, Ravel generates the workmux prompt
variant and executes workmux without a shell:

```txt
workmux add T0001-example-task --open-if-exists --prompt <generated-prompt>
```

`--open-if-exists` makes repeated selection idempotent: workmux creates a new
task worktree/window when needed or opens the existing one. Prompt injection
is delegated to workmux, which knows how to invoke the agent configured in its
global or project configuration. It passes the prompt directly to matching
agent panes using that agent's supported CLI syntax, so Ravel does not also
copy the prompt to the clipboard on this successful path.

The tmux passthrough result does not gate launch. A disabled or limited setting
only warns that the ready-for-review notification may not reach the outer
terminal; workmux creation and prompt injection still proceed.

For a `ready-to-merge` task, Ravel instead executes the same command without
`--prompt`. This reopens the registered worktree without starting a duplicate
implementation prompt.

Ravel does not pass a base branch, main branch, worktree directory, pane
layout, setup hook, file operation, or agent command. Workmux owns those
choices. In particular:

- Workmux auto-detects its merge target.
- Workmux uses its configured `base_branch` for new worktrees, or its own
  documented default when that setting is absent.
- Users who want every task to start from the effective main branch can set
  `base_branch: auto` in workmux configuration.
- The workmux `agent` setting or named agent configuration determines the
  command that receives the prompt.
- Workmux file operations and hooks handle `.env`, dependency directories,
  installs, and other worktree setup.
- After explicit `LGTM`, the agent uses `workmux rebase` and
  `workmux merge --rebase --notification`; workmux determines the saved base
  and merge target and performs the merge and cleanup lifecycle.

Ravel inherits workmux's standard streams and exit status. If workmux fails,
Ravel reports its output and does not attempt its own repair or cleanup. For a
task that needs agent work, Ravel then generates the manual prompt variant and
enters manual prompt mode so the instructions remain usable.

## Manual Prompt Mode

If Git, tmux, or workmux is unavailable, Ravel does not fail after selection.
For a task that still needs agent work, it generates the manual prompt variant,
prints which workflow tools are unavailable, copies the full prompt to the
clipboard, prints the prompt, and reports whether the copy succeeded.

The user can open an AI agent in any checkout and paste the prompt. Ravel does
not create a branch, change directory, change task status, or start an agent
in this mode.

Clipboard writing exists only for this manual/error fallback. Clipboard
failure is recoverable because the complete prompt is printed.

## Configuration

Ravel v2 has no configuration file and no configuration UI.

Agent command, multiplexer layout, worktree location, base/main branch rules,
file sharing, and lifecycle hooks belong in workmux configuration. Ravel does
not read or write `.workmux.yaml` or workmux's global configuration.

A minimal workmux configuration for the intended workflow is:

```yaml
agent: codex
base_branch: auto
panes:
  - command: <agent>
    focus: true
```

The user chooses the agent. `base_branch: auto` makes new worktrees start from
workmux's effective main branch, and the agent pane lets workmux inject Ravel's
prompt. Ravel does not validate these preferences. Workmux injects prompts
only into matching agent panes, so direct prompt delivery assumes the user has
configured one as shown.

## Migrating from v1

The README contains the complete migration procedure:

```txt
Remove the .ravel/ directory.
```

Nothing else is required. The committed `ravel/` task and documentation
folders remain valid, and the Ravel section already installed in `AGENTS.md`
is reused. V2 neither reads nor recreates `.ravel/`.

## Removed v1 Surface

The v2 implementation removes or leaves removed:

- Ink and React TUI code.
- Slash commands and interactive assign mode.
- `assign`, `prompt`, `integrate`, and `cleanup` subcommands.
- Commander-based command routing.
- Chokidar file watching and event models.
- Ravel configuration, session JSON, and logs.
- Git worktree creation, integration, and cleanup code.
- Ravel-owned tmux launching and session tracking.
- Agent selection and command execution.
- Ravel-owned notification processes and configuration.
- Clipboard preference state.

The implementation retains and simplifies:

- Task filename and frontmatter parsing.
- Task status and dependency validation.
- Read-only registered-worktree discovery through Git's porcelain format.
- `fzf` record formatting, preview, and selection.
- Prompt generation and clipboard writing.
- Template installation and surgical `AGENTS.md` updates.

Expected runtime dependencies remain `clipboardy`, `gray-matter`, and `zod`.
`fzf`, Git, tmux, workmux, and the agent are external executables.

## Implementation Plan

1. Keep the completed v1 runtime removal as the v2 baseline.
2. Implement the small public command router and idempotent `ravel init`.
3. Add the doctor check model, individual check modules, and mandatory-only
   preflight.
4. Add project discovery and the `fzf` task picker.
5. Update prompt generation for the workmux-owned lifecycle.
6. Delegate launch/resume to workmux and add manual prompt fallback.
7. Rewrite the README and update package metadata for `2.0.0`.
8. Verify the public workflows and audit the package for obsolete v1 code.

Each step should remain surgical. Ravel must not grow adapters for work that
workmux already exposes.

## Test Plan

Automated tests use fake executables and temporary directories. They do not
require interactive fzf, Git repositories, tmux, workmux, a real clipboard,
or an installed coding agent.

### Initialization

- Create only `ravel/docs/`, `ravel/tasks/`, the conventions file, and the
  Ravel section in `AGENTS.md`.
- Preserve an existing conventions file and unrelated `AGENTS.md` content.
- Remain idempotent and never create `.ravel/` or edit `.gitignore`.

### Doctor

- Run every check command and preserve its output.
- Report mandatory and recommended failures distinctly.
- Return status 1 only for mandatory failure.
- Check tmux passthrough only inside tmux, distinguish `all`, limited `on`, and
  disabled values, and print configuration guidance without mutation.
- Prove bare `ravel` runs only mandatory checks before the picker.

### Tasks and picker

- Discover the project from its root and nested directories.
- Parse every valid status and reject malformed tasks or missing dependencies.
- Parse `git worktree list --porcelain -z` and match exact branch refs to
  absolute worktree paths without assuming workmux's directory layout.
- Use primary statuses for dependencies, overlay live worktree statuses, and
  derive `ready-to-merge` without persisting it.
- Exclude primary `done`, preserve group ordering, and preview the resolved
  primary or worktree file.
- Make cancellation and blocked selection mutation-free.

### Prompt and workmux

- Include the task identity, initial `in-progress` transition, verification,
  `review` gate, best-effort notification, explicit `LGTM` gate, exact
  one-commit format, separate workmux rebase and verification, and workmux
  merge handoff in the prompt.
- Verify both OSC 9 notification commands and their non-blocking trigger.
- Exclude agent and branch names and prohibit direct push, merge, and cleanup
  commands while allowing only the named workmux lifecycle after approval.
- Invoke `workmux add <branch> --open-if-exists --prompt <prompt>` as argument
  arrays without shell interpolation when the Git, tmux, and workmux
  availability checks pass, without also copying the prompt. Passthrough
  warnings do not block launch.
- Reopen `ready-to-merge` worktrees without a new implementation prompt.
- Generate, print, and copy the manual prompt variant only when an availability
  check or workmux launch fails.
- Preserve workmux output and exit status without attempting cleanup.

### Acceptance

- `ravel`, `ravel init`, and `ravel doctor` are the complete documented v2
  workflow.
- README migration guidance says only to remove `.ravel/`.
- README and doctor document tmux passthrough for ready-for-review
  notifications.
- The conventions template and generated `AGENTS.md` section remain reusable;
  the workmux task prompt supplies the narrow post-approval lifecycle
  exceptions.
- Ravel reads Git's registered worktree metadata but contains no direct
  worktree lifecycle implementation; workmux owns those operations.
- A clean build succeeds, `npm run lint` passes, and `npm test` passes in full.
