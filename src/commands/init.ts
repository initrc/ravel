import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import * as readline from "node:readline";
import { DEFAULT_CONFIG } from "./config.js";

const thisDir = path.dirname(fileURLToPath(import.meta.url));

function templatePath(name: string, baseDir: string): string {
  return path.join(baseDir, name);
}

const defaultTemplateDir = path.join(thisDir, "..", "templates");

const KNOWN_AGENTS = [
  "claude",
  "codex",
  "gemini-cli",
  "qwen",
  "opencode",
  "pi",
];

export function isOnPath(cmd: string): boolean {
  try {
    execFileSync("which", [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function findAgentsOnPath(): string[] {
  return KNOWN_AGENTS.filter((cmd) => isOnPath(cmd));
}

function pickAgent(available: string[]): Promise<string> {
  return new Promise((resolve) => {
    if (available.length === 0) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      console.log("\nNo known AI coding agents found on your PATH.");
      console.log("Known agents: " + KNOWN_AGENTS.join(", "));
      rl.question("Enter the command for your agent: ", (answer) => {
        rl.close();
        resolve(answer.trim() || "claude");
      });
      return;
    }

    console.log("\nSelect the AI coding agent you'd like to use:");
    available.forEach((agent, i) => {
      console.log(`  ${i + 1}. ${agent}`);
    });
    console.log("");

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    const onData = (data: Buffer) => {
      const key = data.toString("utf-8");
      // Check for digit keys 1-9
      const digit = parseInt(key, 10);
      if (digit >= 1 && digit <= available.length) {
        cleanup();
        resolve(available[digit - 1]);
      }
      // Ctrl-C to cancel
      if (key === "\x03") {
        cleanup();
        process.exit(1);
      }
    };

    const cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.removeListener("data", onData);
      process.stdin.pause();
    };

    process.stdin.on("data", onData);
  });
}

async function pickAgentInteractive(): Promise<string> {
  const available = findAgentsOnPath();
  return pickAgent(available);
}

function detectTestCommand(cwd: string): string {
  const pkgPath = path.join(cwd, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return "";
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
  } catch {
    return "";
  }

  const scripts = pkg.scripts as Record<string, string> | undefined;
  if (scripts && typeof scripts.test === "string") {
    console.log(
      "Detected npm test script. testCommand runs your test suite before merging. Set to 'npm test'.",
    );
    return "npm test";
  }

  console.log(
    "No npm test script detected. testCommand runs your test suite before merging. Set it in .ravel/config.json.",
  );
  return "";
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeIfMissing(filePath: string, content: string): boolean {
  if (fs.existsSync(filePath)) return false;
  fs.writeFileSync(filePath, content, "utf-8");
  return true;
}

function ensureGitignore(cwd: string): void {
  const gitignorePath = path.join(cwd, ".gitignore");
  const entries = [".ravel/", ".worktrees/"];

  let existing = "";
  if (fs.existsSync(gitignorePath)) {
    existing = fs.readFileSync(gitignorePath, "utf-8");
  }

  const missing = entries.filter((entry) => !existing.includes(entry));
  if (missing.length === 0) return;

  const suffix = existing.endsWith("\n") ? "" : "\n";
  fs.writeFileSync(
    gitignorePath,
    existing + suffix + missing.join("\n") + "\n",
    "utf-8",
  );
}

function generateAgentsMd(cwd: string, templatesDir: string): void {
  const agentsPath = path.join(cwd, "AGENTS.md");
  const templateContent = fs.readFileSync(
    templatePath("AGENTS.md", templatesDir),
    "utf-8",
  );

  // The ravel section is everything after the top-level heading (if present)
  const ravelSection = templateContent.replace(/^# AGENTS\.md\n\n?/, "").trim();

  if (!fs.existsSync(agentsPath)) {
    fs.writeFileSync(agentsPath, templateContent.trim() + "\n", "utf-8");
    return;
  }

  const existing = fs.readFileSync(agentsPath, "utf-8");
  const headingRegex = /^## Ravel Conventions$/m;

  if (headingRegex.test(existing)) {
    // Replace existing section (from ## Ravel Conventions through next ## or EOF)
    const idx = existing.search(headingRegex);
    const before = existing.slice(0, idx);
    const afterStart = idx + "## Ravel Conventions".length;
    const rest = existing.slice(afterStart);
    const nextHeading = rest.search(/^## /m);
    const after = nextHeading === -1 ? "" : rest.slice(nextHeading);
    const cleanedBefore = before.endsWith("\n\n")
      ? before.trimEnd() + "\n\n"
      : before.replace(/\n*$/, "\n\n");
    fs.writeFileSync(
      agentsPath,
      cleanedBefore +
        ravelSection +
        "\n" +
        (after ? "\n" + after.trimStart() : ""),
      "utf-8",
    );
  } else {
    // Append
    const suffix = existing.endsWith("\n") ? "\n" : "\n\n";
    fs.writeFileSync(
      agentsPath,
      existing + suffix + ravelSection + "\n",
      "utf-8",
    );
  }
}

export async function initCommand(
  cwd: string = process.cwd(),
  templateDir?: string,
  agent?: string,
): Promise<void> {
  const templatesDir = templateDir ?? defaultTemplateDir;
  const configPath = path.join(cwd, ".ravel", "config.json");

  if (fs.existsSync(configPath)) {
    console.log("Ravel is already initialized.");
    return;
  }

  // Create directory structure
  ensureDir(path.join(cwd, "ravel", "docs"));
  ensureDir(path.join(cwd, "ravel", "tasks"));
  ensureDir(path.join(cwd, ".ravel", "sessions"));
  ensureDir(path.join(cwd, ".ravel", "logs"));

  // Copy ravel-conventions.md template (idempotent)
  const conventionsSrc = templatePath("ravel-conventions.md", templatesDir);
  const conventionsDest = path.join(
    cwd,
    "ravel",
    "docs",
    "ravel-conventions.md",
  );
  if (fs.existsSync(conventionsSrc)) {
    writeIfMissing(conventionsDest, fs.readFileSync(conventionsSrc, "utf-8"));
  }

  // Pick agent command
  let agentCommand = agent;
  if (agentCommand === undefined) {
    agentCommand = await pickAgentInteractive();
  }

  // Detect test command
  const testCommand = detectTestCommand(cwd);

  // Generate .ravel/config.json
  const config = { ...DEFAULT_CONFIG, agentCommand, testCommand };
  writeIfMissing(configPath, JSON.stringify(config, null, 2) + "\n");

  // Add entries to .gitignore
  ensureGitignore(cwd);

  // Generate/update AGENTS.md
  generateAgentsMd(cwd, templatesDir);

  console.log("Ravel project initialized.");
  console.log("  Created: ravel/docs/, ravel/tasks/");
  console.log("  Created: .ravel/sessions/, .ravel/logs/");
  console.log("  Created: .ravel/config.json");
  console.log("  Updated: .gitignore");
  console.log("  Updated: AGENTS.md");
  console.log();
  console.log("The rest of the settings can be edited in .ravel/config.json.");
}
