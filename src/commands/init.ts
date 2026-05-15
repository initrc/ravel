import * as fs from "node:fs";
import * as path from "node:path";
import { DEFAULT_CONFIG } from "../config.js";

function templatePath(name: string): string {
  return path.join(__dirname, "..", "templates", name);
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

export function initCommand(cwd: string = process.cwd()): void {
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
  const conventionsSrc = templatePath("ravel-conventions.md");
  const conventionsDest = path.join(
    cwd,
    "ravel",
    "docs",
    "ravel-conventions.md",
  );
  if (fs.existsSync(conventionsSrc)) {
    writeIfMissing(conventionsDest, fs.readFileSync(conventionsSrc, "utf-8"));
  }

  // Generate .ravel/config.json with defaults (idempotent)
  writeIfMissing(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n");

  // Add entries to .gitignore
  ensureGitignore(cwd);

  console.log("Ravel project initialized.");
  console.log("  Created: ravel/docs/, ravel/tasks/");
  console.log("  Created: .ravel/sessions/, .ravel/logs/");
  console.log("  Created: .ravel/config.json");
  console.log("  Updated: .gitignore");
}
