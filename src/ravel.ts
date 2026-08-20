#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { initCommand } from "./commands/init.js";
import { CheckLevel } from "./doctor/check.js";
import {
  doctor as ravelDoctor,
  Doctor,
  DoctorDisplay,
} from "./doctor/doctor.js";
import { TaskPickerState } from "./models/resolved-task.js";
import { taskPicker as ravelTaskPicker, TaskPicker } from "./task-picker.js";

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
  doctor: Doctor = ravelDoctor,
  taskPicker: TaskPicker = ravelTaskPicker,
): number {
  if (args.length === 0) {
    const results = doctor.check(CheckLevel.Mandatory, DoctorDisplay.Failures);
    if (results.some((result) => result.isMandatoryFailure())) {
      return 1;
    }
    try {
      const selectedTask = taskPicker.pick(cwd);
      if (selectedTask?.state === TaskPickerState.Blocked) {
        const dependencies = selectedTask.incompleteDependencies
          .map((dependency) => `${dependency.id} (${dependency.title})`)
          .join(", ");
        console.error(
          `${selectedTask.task.id} is blocked by incomplete dependencies: ${dependencies}`,
        );
        return 1;
      }
      return 0;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
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
      return doctor
        .check(undefined, DoctorDisplay.All)
        .some((result) => result.isMandatoryFailure())
        ? 1
        : 0;
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
