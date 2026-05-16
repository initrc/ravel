import * as readline from "node:readline";
import type { Task } from "./task.js";
import { readConfig, writeConfig } from "./config.js";

// clipboardy is ESM-only; dynamic import in a CJS project
async function writeClipboard(text: string): Promise<void> {
  const clipboardy = await import("clipboardy");
  clipboardy.default.writeSync(text);
}

export function generatePrompt(task: Task): string {
  return `You are working in a git worktree for task ${task.id}.

Implement the task described in:
ravel/tasks/${task.filename}

When the implementation is ready for human review:
- update the task status to review
- stop and wait for my feedback

If I later say LGTM:
- update the task status to done
- create exactly one local git commit
- use this commit message format:
  ${task.id}: ${task.title}

Do not push, merge, rebase, or delete branches.`;
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

export async function promptForClipboard(
  promptText: string,
  cwd: string = process.cwd(),
): Promise<void> {
  const config = readConfig(cwd);

  if (config.copyPromptByDefault) {
    await writeClipboard(promptText);
    console.log("Prompt copied to clipboard.");
    return;
  }

  console.log("\nPrompt copied? [1. Copy / 2. Always copy / Esc. Do not copy]");

  const choice = await waitForKeypress();

  if (choice === "1") {
    await writeClipboard(promptText);
    console.log("Copied!");
  } else if (choice === "2") {
    await writeClipboard(promptText);
    config.copyPromptByDefault = true;
    writeConfig(cwd, config);
    console.log("Copied! Copy-on-prompt set as default.");
  } else {
    console.log("Not copied.");
  }
}
