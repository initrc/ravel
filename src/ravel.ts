#!/usr/bin/env node
import { Command } from "commander";
import * as path from "node:path";

import { createElement } from "react";
import { render } from "ink";
import { initCommand, isOnPath } from "./commands/init.js";
import { assignCommand, cleanupWorktree } from "./commands/assign.js";
import { runIntegration } from "./commands/integrate.js";
import { requireInit, readConfig } from "./commands/config.js";
import { notify } from "./commands/notify.js";
import { TaskCollection } from "./models/task.js";
import { App } from "./tui/app.js";
import {
  generatePrompt,
  promptForClipboard,
  generateLaunchCommand,
  commandForClipboard,
} from "./commands/prompt.js";


const program = new Command();

program
  .name("ravel")
  .description("Orchestrator for interactive AI coding sessions")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a Ravel project")
  .action(async () => {
    await initCommand();
  });

program
  .command("assign <taskId>")
  .description("Create a git worktree for a task and launch the builder")
  .action(async (taskId: string) => {
    requireInit();
    try {
      const { session } = await assignCommand(taskId);

      console.log(`Worktree created at ${session.worktreePath}`);
      console.log(`Branch: ${session.branch}`);

      const config = readConfig();
      const ravelCmd = isOnPath("ravel")
        ? "ravel"
        : "node './bin/ravel.js'";
      const worktreeAbs = path.resolve(process.cwd(), session.worktreePath);
      const command = generateLaunchCommand(
        session.taskId,
        ravelCmd,
        process.cwd(),
        worktreeAbs,
        config.agentCommand,
      );

      console.log(
        "\nRun this command in a new terminal or tab.\n" +
          "When your coding agent launches, a prepared prompt will be in your clipboard.\n" +
          "Paste it there.\n",
      );
      console.log(`${command}`);
      await commandForClipboard(command);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command("cleanup <taskId>")
  .description("Remove a task's worktree and branch")
  .action(async (taskId: string) => {
    requireInit();
    try {
      await cleanupWorktree(taskId);
      console.log(`Cleaned up worktree and branch for ${taskId}`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command("prompt <taskId>")
  .description("Generate a builder prompt for a task")
  .option("--copy", "Copy to clipboard without the interactive menu")
  .action(async (taskId: string, options: { copy?: boolean }) => {
    requireInit();
    try {
      const tasksDir = path.join(process.cwd(), "ravel", "tasks");
      const collection = TaskCollection.load(tasksDir);
      const task = collection.get(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }
      const config = readConfig();
      const prompt = generatePrompt(task, config.mainBranch);
      console.log(prompt);
      await promptForClipboard(prompt, options.copy ?? false);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command("integrate <taskId>")
  .description("Run integration flow for a completed task")
  .action(async (taskId: string) => {
    requireInit();
    const config = readConfig();
    try {
      await runIntegration(taskId, process.cwd(), (event) => {
        switch (event.type) {
          case "progress":
            console.log(event.message);
            break;
          case "conflict":
            console.error(event.message);
            notify(event, config.notifyWhenDone);
            break;
          case "test-failure":
            console.error(event.message);
            console.error(event.output);
            notify(event, config.notifyWhenDone);
            break;
          case "error":
            console.error(event.message);
            notify(event, config.notifyWhenDone);
            break;
          case "complete":
            console.log(`${event.taskId} integration complete`);
            notify(event, config.notifyWhenDone);
            break;
        }
      });
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

// Default: launch TUI (T0007)
program.action(async () => {
  requireInit();
  const ravelCmd = isOnPath("ravel")
    ? "ravel"
    : "node './bin/ravel.js'";
  const { waitUntilExit } = render(
    createElement(App, { projectRoot: process.cwd(), ravelCmd }),
    { exitOnCtrlC: false },
  );
  await waitUntilExit();
});

program.parse();
