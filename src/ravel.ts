#!/usr/bin/env node
import { Command } from "commander";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { initCommand } from "./commands/init.js";
import { assignCommand, cleanupWorktree } from "./commands/assign.js";
import { requireInit, readConfig } from "./config.js";
import { TaskCollection } from "./task.js";
import {
  generatePrompt,
  promptForClipboard,
  generateLaunchCommand,
  commandForClipboard,
} from "./prompt.js";

function isRavelOnPath(): boolean {
  try {
    execFileSync("ravel", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const program = new Command();

program
  .name("ravel")
  .description("Orchestrator for interactive AI coding sessions")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a Ravel project")
  .action(() => {
    initCommand();
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
      const ravelCmd = isRavelOnPath()
        ? "ravel"
        : `node '${path.join(path.dirname(fileURLToPath(import.meta.url)), "ravel.js")}'`;
      const worktreeAbs = path.resolve(process.cwd(), session.worktreePath);
      const command = generateLaunchCommand(
        session.taskId,
        ravelCmd,
        worktreeAbs,
        config.builderCommand,
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
      const prompt = generatePrompt(task);
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
  .action((_taskId: string) => {
    requireInit();
    // T0008
    console.log("integrate command not yet implemented");
  });

// Default: launch TUI (T0007)
program.action(() => {
  requireInit();
  // T0007
  console.log("TUI not yet implemented");
});

program.parse();
