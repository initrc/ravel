#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { assignCommand, cleanupWorktree } from "./commands/assign.js";
import { requireInit } from "./config.js";

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
  .description("Create a git worktree for a task")
  .action(async (taskId: string) => {
    requireInit();
    try {
      const session = await assignCommand(taskId);
      console.log(`Worktree created at ${session.worktreePath}`);
      console.log(`Branch: ${session.branch}`);
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
