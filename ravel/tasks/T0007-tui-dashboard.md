---
id: T0007
title: Interactive TUI dashboard
status: new
dependencies:
  - T0002
  - T0006
---

# Scope

- Implement `ravel` (no subcommand) to launch an interactive terminal UI.
- Top section: task columns — New, In Progress, Review, Blocked.
- No Done column (done tasks disappear).
- Middle section: scrolling event log.
- Bottom section: slash command input.
- Support slash commands: `/assign`, `/config`, `/help`.
- React to file watch events in real time.

# Acceptance

- Dashboard shows tasks in correct columns based on status and blocked state.
- Tasks move between columns in real time as statuses change.
- Event log shows: task status changes, new tasks, new docs.
- Slash command input accepts and routes commands.
- `/help` lists available commands.
- Clean exit on Ctrl+C or `/quit`.

# Implementation Notes

- Use Ink (React for terminal) for the TUI.
- Task columns derived from T0002 parsing + blocked computation.
- Event log fed by T0006 file watcher events.
- Slash commands dispatch to existing command implementations.
- The TUI is launched by running `ravel` with no subcommand.

## Component tree

```
<App>
  <Dashboard>
    <TaskColumns>          ← top section
      <Column title="New" />
      <Column title="In Progress" />
      <Column title="Review" />
      <Column title="Blocked" />
    </TaskColumns>
    <EventLog />           ← middle section, scrollable
    <CommandInput />       ← bottom section, slash commands
  </Dashboard>
</App>
```

## State management

Use Ink's built-in `useState` and `useEffect`. No external state manager.

The `<App>` component owns the canonical state:

```ts
// In App component
const [tasks, setTasks] = useState<Task[]>([]);
const [events, setEvents] = useState<LogEvent[]>([]);

useEffect(() => {
  // Initial load from TaskCollection
  const collection = TaskCollection.load(tasksDir);
  setTasks(collection.list());

  // Subscribe to file watcher events
  const watcher = new RavelWatcher(projectRoot);
  watcher.on("task-status-changed", (e) => {
    // Reload the task from disk, update state
  });
  watcher.on("task-created", (e) => {
    // Reload all tasks
  });
  watcher.start();
  return () => watcher.stop();
}, []);
```

## Task column assignment

Columns are derived:

```
New:        status === "new" && !blocked
In Progress: status === "in-progress"
Review:     status === "review"
Blocked:    status === "new" && blocked
```

Done tasks (status === "done") are excluded from all columns.

## Event log

The log is a ring buffer of the last 100 events, rendered as a scrollable list. Each event is a single line:

```
T0003 is in progress
T0003 is ready for review
T0004 is created
design-v1.md is created
```

Format events using the event type:
- `task-status-changed` → `"<id> is <newStatus>"` (use "ready for review" when newStatus is "review")
- `task-created` → `"<id> is created"`
- `doc-created` → `"<filename> is created"`

## Command input

The bottom line is a single-line text input. Slash commands are processed on Enter:
- `/assign <taskId>` — runs the assign flow (T0005). Since the TUI owns the terminal, `/assign` prints a message telling the user to run `ravel assign <taskId>` in another terminal. In v1, slash commands in the TUI are informational/help only.
- `/config` — prints the current config.
- `/help` — lists available slash commands.
- `/quit` — clean exit.

## Layout with Ink

Use Ink's `Box` with flexbox for layout. The terminal is divided vertically:

```
┌─────────────────────────────┐
│  New  │ In Progress │ Rev   │  ← TaskColumns (fixed height)
│ T0001 │ T0003       │       │
│ T0002 │             │       │
├─────────────────────────────┤
│ T0003 is ready for review   │  ← EventLog (fills remaining space
│ T0004 is created            │     scrollable)
│ ...                         │
├─────────────────────────────┤
│ > /assign T0005             │  ← CommandInput (single line, bottom)
└─────────────────────────────┘
```

Use Ink's `Static` or manual scroll tracking for the event log. Use `useInput` from Ink for keyboard input handling (Ctrl+C for exit).
