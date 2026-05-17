import { useState, useEffect } from "react";
import * as path from "node:path";
import { useInput, useApp } from "ink";
import { Dashboard } from "./components/Dashboard.js";
import { RavelWatcher } from "../watcher.js";
import { TaskCollection, type Task } from "../models/task.js";
import { readConfig } from "../commands/config.js";
import { assignCommand } from "../commands/assign.js";
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

  useEffect(() => {
    const collection = TaskCollection.load(tasksDir);
    setTasks(collection.list());

    const watcher = new RavelWatcher(projectRoot);

    watcher.on("event", (event: RavelEvent) => {
      setEvents((prev) => {
        const next = [
          ...prev,
          { timestamp: new Date(), message: formatEvent(event) },
        ];
        return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
      });

      if (
        event.type === "task-created" ||
        event.type === "task-status-changed"
      ) {
        const reloaded = TaskCollection.load(tasksDir);
        setTasks(reloaded.list());
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
        "  /help           Show this help",
        "  /config         Show current configuration",
        "  /assign <id>    Assign a task",
        "  /exit or /quit  Exit the dashboard",
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
