#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
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
  .description("Assign a task to a new Builder session")
  .action((_taskId: string) => {
    requireInit();
    // T0005
    console.log("assign command not yet implemented");
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
