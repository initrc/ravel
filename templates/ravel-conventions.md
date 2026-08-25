# Ravel Conventions

## Design Docs

Design docs must be stored in:

```txt
ravel/docs/
```

Example:

```txt
ravel/docs/design-v1.md
```

Design docs describe:
- technical architecture
- implementation plans
- important technical decisions

---

## Tasks

Tasks must be stored in:

```txt
ravel/tasks/
```

Task filename format:

```txt
T0003-apply-shadcn-ui-primitives.md
```

Rules:
- Use zero-padded task IDs (`T0001`)
- Use lowercase kebab-case title in filename
- Keep filenames concise
- To pick the next task ID, find the highest-numbered task in `ravel/tasks/` and increment (e.g., if T0032 is highest, next is T0033)

---

## Task Format

Tasks must use Markdown with YAML frontmatter.

Required schema:

```yaml
id: T0003
title: Apply shadcn ui primitives
status: new
dependencies:
  - T0002
```

Rules:
- `id` must match filename
- `title` should be short and action-oriented
- `status` must be one of:
  - `new`
  - `in-progress`
  - `review`
  - `done`
- `dependencies` may be empty

Example with no dependencies:

```yaml
id: T0004
title: Add task parser
status: new
dependencies: []
```

Task body structure (all three sections are required):

```md
# Scope

- What should be implemented — a concise summary of the change.

# Acceptance

- Concrete, verifiable success criteria.
- When code changes are involved, include that the project builds, passes lint, and all tests pass.

# Implementation Notes

- File paths and line numbers the implementer should start from.
- References to related tasks (e.g., "the rebase instruction was added in T0029").
- Architectural decisions — which patterns or libraries to adopt and their tradeoffs.
- Technical constraints or edge cases to watch for.
```

---

## Dependency Rules

- When creating a new task, do not add any task that is done to the dependencies list.
- A task is blocked when any dependency is not `done`.
- Blocked state is computed and should never be written to the task file.

---

## Implementation Workflow

The generated task prompt declares either `workmux` or `manual` launch mode.
Follow the shared workflow and then the matching post-approval workflow.

### Shared workflow

1. Read the task file first and read any referenced design docs.
2. If the task status is `new`, update it to `in-progress` before implementation.
3. Implement only the requested scope.
4. Run all verification required by the task and repository instructions.
5. When the implementation is ready for human review:
   - update the task status to `review`
   - report that the task is ready for review
   - stop without committing, integrating, or cleaning up
   - explicitly wait for the user to say `LGTM`
6. Only after receiving explicit `LGTM`:
   - update the task status to `done`
   - create exactly one local commit containing the approved task changes

Use this exact commit message format, taking the ID and title from the task:

```txt
T0003: Apply shadcn ui primitives
```

Before explicit `LGTM`, do not commit, push, rebase, merge, remove worktrees, or
delete branches.

### `workmux` workflow

After completing the shared post-`LGTM` steps:

1. Run `workmux rebase` without a branch argument.
2. If it conflicts, resolve and stage the changes, then run
   `git rebase --continue`. Do not create another commit.
3. Run the full verification required by the task and repository.
4. If verification passes, run `workmux merge --rebase --notification`.
5. If that command finds newer conflicts, resolve them, continue the rebase,
   rerun verification, and retry the command.

Do not run `git push`, `git merge`, `git rebase`, `git worktree remove`, or
`git branch -d` directly. Use `git rebase --continue` only to resolve conflicts
from the workmux commands above.

### `manual` workflow

After completing the shared post-`LGTM` steps, stop and report the current
branch name to the user. Integration and cleanup belong to the user.

Do not run `git push`, `git rebase`, `git merge`, `git worktree remove`, or
`git branch -d`.
