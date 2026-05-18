import * as path from "node:path";
import * as readline from "node:readline";
import type { Task } from "../models/task.js";
import { readConfig, writeConfig } from "./config.js";

// clipboardy is ESM-only; dynamic import in a CJS project
async function writeClipboard(text: string): Promise<void> {
  const clipboardy = await import("clipboardy");
  clipboardy.default.writeSync(text);
}

export function generatePrompt(task: Task, mainBranch: string): string {
  return `You are working in a git worktree for task ${task.id}.

Implement the task described in:
ravel/tasks/${task.filename}

When the implementation is ready for human review:
- verify the build, all tests and lint passed
- update the task status to review
- stop and wait for my feedback

If I later say LGTM:
- update the task status to done
- create exactly one local git commit
- use this commit message format:
  ${task.id}: ${task.title}
- rebase onto local's ${mainBranch} branch
- resolve any conflicts from the rebase and verify the build, all tests and lint passed`;
}

async function waitForKeypress(): Promise<string> {
  return new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    const onKeypress = (str: string, key: readline.Key) => {
      if (key.name === "escape") {
        cleanup();
        resolve("escape");
      } else if (str === "1") {
        cleanup();
        resolve("1");
      } else if (str === "2") {
        cleanup();
        resolve("2");
      }
    };

    const cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.removeListener("keypress", onKeypress);
      process.stdin.pause();
    };

    process.stdin.on("keypress", onKeypress);
    process.stdin.resume();
  });
}

export function generateLaunchCommand(
  taskId: string,
  ravelCmd: string,
  projectRoot: string,
  worktreePath: string,
  agentCommand: string,
): string {
  const relWorktree = path.relative(projectRoot, worktreePath);
  return (
    `cd '${projectRoot}'` +
    ` && ${ravelCmd} prompt ${taskId} --copy` +
    ` && cd '${relWorktree}'` +
    ` && ${agentCommand}`
  );
}

export async function promptForClipboard(
  promptText: string,
  copy = false,
): Promise<void> {
  if (copy) {
    await writeClipboard(promptText);
    console.log(
      "\nPrompt copied to clipboard — paste it in your AI agent to start.",
    );
    return;
  }

  console.log("\nCopy prompt? [1. Copy / 2. Always copy / Esc. Do not copy]");

  const choice = await waitForKeypress();

  if (choice === "1") {
    await writeClipboard(promptText);
    console.log("Prompt copied!");
  } else if (choice === "2") {
    await writeClipboard(promptText);
    console.log("Prompt copied!");
  } else {
    console.log("Not copied.");
  }
}

export async function commandForClipboard(
  commandText: string,
  cwd: string = process.cwd(),
): Promise<void> {
  const config = readConfig(cwd);

  if (config.copyCommandByDefault) {
    await writeClipboard(commandText);
    return;
  }

  console.log("\nCopy command? [1. Copy / 2. Always copy / Esc. Do not copy]");

  const choice = await waitForKeypress();

  if (choice === "1") {
    await writeClipboard(commandText);
    console.log("Command copied!");
  } else if (choice === "2") {
    await writeClipboard(commandText);
    config.copyCommandByDefault = true;
    writeConfig(cwd, config);
    console.log("Command copied! Copy-on-default set.");
  } else {
    console.log("Not copied.");
  }
}
