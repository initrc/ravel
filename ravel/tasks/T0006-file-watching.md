---
id: T0006
title: File watching system
status: done
dependencies:
  - T0001
---

# Scope

- Watch `ravel/tasks/*.md` for task status changes.
- Watch `ravel/docs/*.md` for design doc changes.
- Watch `.ravel/sessions/*.json` for new session files.
- When a new session appears, dynamically start watching `.worktrees/<task-id>/ravel/tasks/*.md`.
- Emit typed events for downstream consumers (TUI, logs).

# Acceptance

- File changes in watched directories emit events with file path and change type.
- New session files trigger dynamic worktree watching.
- Task status changes in worktrees are detected.
- Events include: task created, task status changed, doc created, session registered.
- File watching is cleanly started and stopped.

# Implementation Notes

- Use chokidar for cross-platform file watching.
- Expose events via a `RavelWatcher` class that extends `EventEmitter`.
- Debounce rapid changes: 100ms delay before emitting. If the same file changes again within 100ms, reset the timer.
- Events carry enough context for consumers to update without re-reading all files.

## Event types

```ts
// events.ts
interface TaskCreatedEvent {
  type: "task-created";
  taskId: string;
  filename: string;
}

interface TaskStatusChangedEvent {
  type: "task-status-changed";
  taskId: string;
  oldStatus: string;
  newStatus: string;
  filePath: string;       // which copy changed (main or worktree)
}

interface DocCreatedEvent {
  type: "doc-created";
  filename: string;
}

interface SessionRegisteredEvent {
  type: "session-registered";
  taskId: string;
  sessionPath: string;
}

type RavelEvent = TaskCreatedEvent | TaskStatusChangedEvent
  | DocCreatedEvent | SessionRegisteredEvent;
```

## RavelWatcher class

```ts
import { EventEmitter } from "events";
import chokidar from "chokidar";

class RavelWatcher extends EventEmitter {
  private mainWatcher: chokidar.FSWatcher;
  private worktreeWatchers: Map<string, chokidar.FSWatcher>;
  private debounceTimers: Map<string, NodeJS.Timeout>;

  constructor(projectRoot: string);
  start(): Promise<void>;
  stop(): Promise<void>;
  private onTaskChange(filePath: string): void;
  private onSessionChange(filePath: string): void;
  private startWatchingWorktree(taskId: string): void;
  private stopWatchingWorktree(taskId: string): void;
}
```

## Watch targets (started on `start()`)

| Pattern | Purpose |
|---------|---------|
| `ravel/tasks/*.md` | Main task status changes |
| `ravel/docs/*.md` | New/modified design docs |
| `.ravel/sessions/*.json` | New sessions (add), removed sessions (cleanup) |

## Dynamic worktree watching

When a session file is created (`.ravel/sessions/T0003.json`):
1. Read the session file to get the `worktreePath`.
2. Start watching `<worktreePath>/ravel/tasks/*.md`.
3. When a task file changes in the worktree, emit `TaskStatusChangedEvent`.

When a session file is removed:
1. Stop the corresponding worktree watcher.
2. Clean up the watcher from `worktreeWatchers`.

## Debounce strategy

```ts
private onTaskChange(filePath: string): void {
  const key = path.basename(filePath);
  if (this.debounceTimers.has(key)) {
    clearTimeout(this.debounceTimers.get(key)!);
  }
  this.debounceTimers.set(key, setTimeout(() => {
    this.debounceTimers.delete(key);
    // Read file, check status change, emit event
  }, 100));
}
```

## Status change detection

To detect status changes, cache the last known status per task ID. On file change, re-parse the file and compare. Only emit `TaskStatusChangedEvent` if the status actually changed (not on every file write).
