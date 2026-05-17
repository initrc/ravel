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
import { generateLaunchCommand } from "../commands/prompt.js";
import type { RavelEvent } from "../models/events.js";

export interface LogEvent {
  timestamp: Date;
  message: string;
}

function formatEvent(event: RavelEvent): string {
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

interface AppProps {
  projectRoot: string;
  ravelCmd: string;
}

export function App({ projectRoot, ravelCmd }: AppProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [commandOutput, setCommandOutput] = useState<string[]>([]);
  const { exit } = useApp();

  const tasksDir = path.join(projectRoot, "ravel", "tasks");

  // Track already-integrated task IDs within this TUI session to prevent
  // double-integration.
  const integratedRef = useRef<Set<string>>(new Set());

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

  const integrateTask = (taskId: string) => {
    if (integratedRef.current.has(taskId)) return;

    integratedRef.current.add(taskId);
    addEvent(`${taskId} integration: starting...`);

    runIntegration(taskId, projectRoot, (event: IntegrationEvent) => {
      switch (event.type) {
        case "progress":
          addEvent(`${taskId} integration: ${event.message}`);
          break;
        case "conflict":
          addEvent(event.message);
          reloadTasks();
          break;
        case "test-failure":
          addEvent(event.message);
          reloadTasks();
          break;
        case "error":
          addEvent(`${event.taskId} integration error: ${event.message}`);
          reloadTasks();
          break;
        case "complete":
          addEvent(`${event.taskId} integration complete`);
          reloadTasks();
          break;
      }
    }).catch((err) => {
      addEvent(`${taskId} integration error: ${(err as Error).message}`);
      reloadTasks();
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
    if (command === "/exit" || command === "/quit") {
      exit();
      return;
    }

    if (command === "/help") {
      setCommandOutput([
        "Available commands:",
        "  /help            Show this help",
        "  /config          Show current configuration",
        "  /assign <id>     Assign a task",
        "  /integrate <id>  Run integration flow for a completed task",
        "  /exit or /quit   Exit the dashboard",
      ]);
      return;
    }

    if (command === "/config") {
      try {
        const config = readConfig(projectRoot);
        setCommandOutput([
          `builderCommand: ${config.builderCommand}`,
          `copyCommandByDefault: ${config.copyCommandByDefault}`,
          `maxConcurrentBuilders: ${config.maxConcurrentBuilders}`,
          `mainBranch: ${config.mainBranch}`,
          `testCommand: ${config.testCommand}`,
          `pushOnIntegration: ${config.pushOnIntegration}`,
        ]);
      } catch (err) {
        setCommandOutput([`Error: ${(err as Error).message}`]);
      }
      return;
    }

    if (command.startsWith("/assign")) {
      const taskId = command.split(" ")[1];
      if (!taskId) {
        setCommandOutput(["Usage: /assign <taskId>"]);
        return;
      }

      try {
        const { session } = await assignCommand(taskId, projectRoot);
        const config = readConfig(projectRoot);
        const worktreeAbs = path.resolve(projectRoot, session.worktreePath);
        const launchCmd = generateLaunchCommand(
          session.taskId,
          ravelCmd,
          worktreeAbs,
          config.builderCommand,
        );

        // Auto-copy since TUI owns the terminal (no interactive prompt)
        const clipboardy = await import("clipboardy");
        clipboardy.default.writeSync(launchCmd);

        setCommandOutput([
          `Assigned ${taskId}: worktree at ${session.worktreePath}`,
          `Launch command copied to clipboard:`,
          `  ${launchCmd}`,
          "",
          "Paste it in a new terminal to start the builder.",
        ]);
      } catch (err) {
        setCommandOutput([`Error: ${(err as Error).message}`]);
      }
      return;
    }

    if (command.startsWith("/integrate")) {
      const taskId = command.split(" ")[1];
      if (!taskId) {
        setCommandOutput(["Usage: /integrate <taskId>"]);
        return;
      }

      integrateTask(taskId);
      setCommandOutput([`Integration started for ${taskId}. See event log for progress.`]);
      return;
    }

    setCommandOutput([`Unknown command: ${command.split(" ")[0]}`]);
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
