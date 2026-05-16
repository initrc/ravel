import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CONFIG } from "../config.js";

const thisDir = path.dirname(fileURLToPath(import.meta.url));

function templatePath(name: string, baseDir: string): string {
  return path.join(baseDir, name);
}

const defaultTemplateDir = path.join(thisDir, "..", "templates");

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
  const templateContent = fs.readFileSync(templatePath("AGENTS.md", templatesDir), "utf-8");

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

export function initCommand(cwd: string = process.cwd(), templateDir?: string): void {
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

  // Generate .ravel/config.json with defaults (idempotent)
  writeIfMissing(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n");

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
}
