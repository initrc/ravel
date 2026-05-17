import { useState, useEffect, useRef } from "react";
import * as fs from "node:fs";
import * as path from "node:path";
import { useInput, useApp } from "ink";
import { Dashboard } from "./components/Dashboard.js";
import { RavelWatcher } from "../watcher.js";
import { TaskCollection, parseTask, type Task } from "../models/task.js";
import { readSession } from "../models/session.js";
import { readConfig } from "../commands/config.js";
import { assignCommand } from "../commands/assign.js";
import { runIntegration } from "../commands/integrate.js";
import type { IntegrationEvent } from "../commands/integrate.js";
import { notify } from "../commands/notify.js";
import { generateLaunchCommand } from "../commands/prompt.js";
import type { RavelEvent } from "../models/events.js";

export interface LogEvent {
  timestamp: Date;
  message: string;
}

export function formatEvent(event: RavelEvent): string {
  switch (event.type) {
    case "task-status-changed":
      if (event.newStatus === "review") {
        return `${event.taskId} is ready for review`;
      }
      return `${event.taskId} is ${event.newStatus}`;
    case "task-created":
      return `${event.taskId} is created`;
    case "doc-created":
      return `${event.filename} is created`;
    case "session-registered":
      return `${event.taskId} session registered`;
  }
}

const MAX_EVENTS = 100;

export type ParsedCommand =
  | { type: "exit" }
  | { type: "help" }
  | { type: "config" }
  | { type: "assign"; taskId: string }
  | { type: "integrate"; taskId: string }
  | { type: "unknown"; raw: string };

export function parseCommand(command: string): ParsedCommand {
  if (command === "/exit" || command === "/quit") return { type: "exit" };
  if (command === "/help") return { type: "help" };
  if (command === "/config") return { type: "config" };

  if (command.startsWith("/assign")) {
    const parts = command.trim().split(/\s+/);
    const taskId = parts[1];
    if (taskId) return { type: "assign", taskId };
    return { type: "unknown", raw: parts[0] };
  }

  if (command.startsWith("/integrate")) {
    const parts = command.trim().split(/\s+/);
    const taskId = parts[1];
    if (taskId) return { type: "integrate", taskId };
    return { type: "unknown", raw: parts[0] };
  }

  const raw = command.trim().split(/\s+/)[0];
  return { type: "unknown", raw };
}

interface AppProps {
  projectRoot: string;
  ravelCmd: string;
}

export function App({ projectRoot, ravelCmd }: AppProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<LogEvent[]>([]);
  interface OutputLine { text: string; highlight?: boolean }
  const [commandOutput, setCommandOutput] = useState<OutputLine[]>([]);
  const { exit } = useApp();

  const tasksDir = path.join(projectRoot, "ravel", "tasks");

  // Track already-integrated task IDs within this TUI session to prevent
  // double-integration.
  const integratedRef = useRef<Set<string>>(new Set());

  // Ensures only one integration runs at a time. Parallel integrations would
  // race on git operations in the main repo (pull, task status updates).
  const integratingRef = useRef(false);

  const addEvent = (message: string) => {
    setEvents((prev) => {
      const next = [...prev, { timestamp: new Date(), message }];
      return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
    });
  };

  // Load tasks from the main repo, then merge in statuses from active
  // worktrees. This keeps the main branch clean (no uncommitted status
  // changes) while reflecting the Builder's actual progress in the TUI.
  const reloadTasks = () => {
    const collection = TaskCollection.load(tasksDir);

    // Merge worktree statuses for active sessions
    const sessionsDir = path.join(projectRoot, ".ravel", "sessions");
    if (fs.existsSync(sessionsDir)) {
      for (const entry of fs.readdirSync(sessionsDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const taskId = entry.name.replace(/\.json$/, "");
        const session = readSession(projectRoot, taskId);
        if (!session) continue;
        const wtTasksDir = path.join(
          projectRoot,
          session.worktreePath,
          "ravel",
          "tasks",
        );
        if (!fs.existsSync(wtTasksDir)) continue;
        for (const wtEntry of fs.readdirSync(wtTasksDir, { withFileTypes: true })) {
          if (!wtEntry.isFile() || !wtEntry.name.endsWith(".md")) continue;
          try {
            const wtTask = parseTask(path.join(wtTasksDir, wtEntry.name));
            if (wtTask.id !== taskId) continue;
            const mainTask = collection.get(wtTask.id);
            if (mainTask && mainTask.status !== wtTask.status) {
              mainTask.status = wtTask.status;
            }
          } catch {
            // skip unparseable files
          }
        }
      }
    }

    setTasks(collection.list());
  };

  // Scan active sessions for any task marked done that hasn't been
  // integrated yet. Used to start the next integration after one finishes,
  // handling the case where multiple tasks are marked done in quick succession.
  const findNextDoneTask = (): string | null => {
    const sessionsDir = path.join(projectRoot, ".ravel", "sessions");
    if (!fs.existsSync(sessionsDir)) return null;
    for (const entry of fs.readdirSync(sessionsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const taskId = entry.name.replace(/\.json$/, "");
      if (integratedRef.current.has(taskId)) continue;
      const session = readSession(projectRoot, taskId);
      if (!session) continue;
      const wtTasksDir = path.join(
        projectRoot,
        session.worktreePath,
        "ravel",
        "tasks",
      );
      if (!fs.existsSync(wtTasksDir)) continue;
      for (const wtEntry of fs.readdirSync(wtTasksDir, { withFileTypes: true })) {
        if (!wtEntry.isFile() || !wtEntry.name.endsWith(".md")) continue;
        try {
          const wtTask = parseTask(path.join(wtTasksDir, wtEntry.name));
          if (wtTask.id === taskId && wtTask.status === "done") {
            return taskId;
          }
        } catch {
          // skip unparseable files
        }
      }
    }
    return null;
  };

  const integrateTask = (taskId: string) => {
    if (integratedRef.current.has(taskId)) return;

    // Serialize: if another integration is in progress, skip for now.
    // findNextDoneTask will pick this task up when the current one finishes.
    if (integratingRef.current) return;

    integratingRef.current = true;
    integratedRef.current.add(taskId);
    addEvent(`${taskId} integration: starting...`);

    const onFinish = () => {
      reloadTasks();
      integratingRef.current = false;
      // Start the next queued integration, if any.
      const nextId = findNextDoneTask();
      if (nextId) integrateTask(nextId);
    };

    runIntegration(taskId, projectRoot, (event: IntegrationEvent) => {
      const config = readConfig(projectRoot);
      switch (event.type) {
        case "progress":
          addEvent(`${taskId} integration: ${event.message}`);
          break;
        case "conflict":
          addEvent(event.message);
          notify(event, config.notifyWhenDone);
          integratedRef.current.delete(taskId);
          onFinish();
          break;
        case "test-failure":
          addEvent(event.message);
          notify(event, config.notifyWhenDone);
          integratedRef.current.delete(taskId);
          onFinish();
          break;
        case "error":
          addEvent(`${event.taskId} integration error: ${event.message}`);
          notify(event, config.notifyWhenDone);
          integratedRef.current.delete(taskId);
          onFinish();
          break;
        case "complete":
          addEvent(`${event.taskId} integration complete`);
          notify(event, config.notifyWhenDone);
          onFinish();
          break;
      }
    }).catch((err) => {
      addEvent(`${taskId} integration error: ${(err as Error).message}`);
      integratedRef.current.delete(taskId);
      onFinish();
    });
  };

  useEffect(() => {
    reloadTasks();

    const watcher = new RavelWatcher(projectRoot);

    watcher.on("event", (event: RavelEvent) => {
      // Always log events
      addEvent(formatEvent(event));

      if (
        event.type === "task-created" ||
        event.type === "task-status-changed"
      ) {
        reloadTasks();

        // Auto-trigger integration when a task in a worktree is marked done
        if (
          event.type === "task-status-changed" &&
          event.newStatus === "done" &&
          event.filePath.includes(".worktrees")
        ) {
          integrateTask(event.taskId);
        }
      }
    });

    void watcher.start();

    return () => {
      void watcher.stop();
    };
  }, [projectRoot, tasksDir]);

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
    }
  });

  const handleCommand = async (command: string) => {
    const parsed = parseCommand(command);

    switch (parsed.type) {
      case "exit":
        exit();
        return;

      case "help":
        setCommandOutput([
          { text: "Available commands:" },
          { text: "  /help            Show this help" },
          { text: "  /config          Show current configuration" },
          { text: "  /assign <id>     Assign a task" },
          { text: "  /integrate <id>  Run integration flow for a completed task" },
          { text: "  /exit or /quit   Exit the dashboard" },
        ]);
        return;

      case "config":
        try {
          const config = readConfig(projectRoot);
          setCommandOutput([
            { text: `agentCommand: ${config.agentCommand}` },
            { text: `copyCommandByDefault: ${config.copyCommandByDefault}` },
            { text: `mainBranch: ${config.mainBranch}` },
            { text: `testCommand: ${config.testCommand}` },
            { text: `notifyWhenDone: ${config.notifyWhenDone}` },
          ]);
        } catch (err) {
          setCommandOutput([{ text: `Error: ${(err as Error).message}` }]);
        }
        return;

      case "assign": {
        try {
          const { session } = await assignCommand(parsed.taskId, projectRoot);
          const config = readConfig(projectRoot);
          const worktreeAbs = path.resolve(projectRoot, session.worktreePath);
          const launchCmd = generateLaunchCommand(
            session.taskId,
            ravelCmd,
            projectRoot,
            worktreeAbs,
            config.agentCommand,
          );

          // Auto-copy since TUI owns the terminal (no interactive prompt)
          const clipboardy = await import("clipboardy");
          clipboardy.default.writeSync(launchCmd);

          setCommandOutput([
            { text: `Assigned ${parsed.taskId}: worktree at ${session.worktreePath}` },
            { text: `Launch command copied to clipboard:` },
            { text: `  ${launchCmd}` },
            { text: "" },
            { text: "Paste it in a new terminal to start the builder.", highlight: true },
          ]);
        } catch (err) {
          setCommandOutput([{ text: `Error: ${(err as Error).message}` }]);
        }
        return;
      }

      case "integrate": {
        integrateTask(parsed.taskId);
        setCommandOutput([{ text: `Integration started for ${parsed.taskId}. See event log for progress.` }]);
        return;
      }

      case "unknown":
        setCommandOutput([{ text: `Unknown command: ${parsed.raw}` }]);
        return;
    }
  };

  // Re-build collection for TaskColumns each render
  const collection =
    tasks.length > 0 ? new TaskCollection(tasks) : new TaskCollection([]);

  return (
    <Dashboard
      tasks={tasks}
      collection={collection}
      events={events}
      commandOutput={commandOutput}
      onCommand={handleCommand}
    />
  );
}
