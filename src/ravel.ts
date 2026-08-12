#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { initCommand } from "./commands/init.js";

const thisFile = fileURLToPath(import.meta.url);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(path.dirname(thisFile), "..", "package.json"), "utf-8"),
) as { version: string };
const templatesDir = path.join(path.dirname(thisFile), "templates");
const usage = "Usage: ravel [init|doctor|--help|--version]";

const help = `${usage}

Commands:
  init       Initialize Ravel in the current directory
  doctor     Check Ravel prerequisites

Options:
  --help     Show help
  --version  Show version`;

export function runCli(
  args: string[],
  cwd: string,
  templatesDir: string,
): number {
  if (args.length === 0) {
    console.error("The Ravel task picker workflow arrives in T0043.");
    return 1;
  }

  if (args.length !== 1) {
    console.error(usage);
    return 1;
  }

  switch (args[0]) {
    case "init":
      try {
        initCommand(cwd, templatesDir);
        return 0;
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 1;
      }
    case "doctor":
      console.error("The Ravel doctor workflow arrives in T0042.");
      return 1;
    case "--help":
      console.log(help);
      return 0;
    case "--version":
      console.log(packageJson.version);
      return 0;
    default:
      console.error(usage);
      return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  process.exitCode = runCli(process.argv.slice(2), process.cwd(), templatesDir);
}
