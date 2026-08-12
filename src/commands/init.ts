import * as fs from "node:fs";
import * as path from "node:path";

function writeAgentsFile(cwd: string, templatesDir: string): void {
  const agentsPath = path.join(cwd, "AGENTS.md");
  const template = fs.readFileSync(
    path.join(templatesDir, "AGENTS.md"),
    "utf-8",
  );
  const ravelSection = template.replace(/^# AGENTS\.md\n\n?/, "").trim();

  if (!fs.existsSync(agentsPath)) {
    fs.writeFileSync(agentsPath, template.trim() + "\n", "utf-8");
    return;
  }

  const existing = fs.readFileSync(agentsPath, "utf-8");
  const ravelHeading = /^## Ravel Conventions$/m;

  // create a ravel section
  if (!ravelHeading.test(existing)) {
    const separator =
      existing.length === 0 ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
    fs.writeFileSync(
      agentsPath,
      existing + separator + ravelSection + "\n",
      "utf-8",
    );
    return;
  }

  // update an existing ravel section
  const sectionStart = existing.search(ravelHeading);
  const before = existing.slice(0, sectionStart).trimEnd();
  const remaining = existing.slice(
    sectionStart + "## Ravel Conventions".length,
  );
  const nextHeading = remaining.search(/^#{1,2} /m);
  const after = nextHeading === -1 ? "" : remaining.slice(nextHeading).trimStart();
  const prefix = before ? `${before}\n\n` : "";
  fs.writeFileSync(
    agentsPath,
    `${prefix}${ravelSection}${after ? `\n\n${after}` : "\n"}`,
    "utf-8",
  );
}

export function initCommand(
  cwd: string,
  templatesDir: string,
): void {
  const docsDir = path.join(cwd, "ravel", "docs");
  const tasksDir = path.join(cwd, "ravel", "tasks");
  const conventionsPath = path.join(docsDir, "ravel-conventions.md");

  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(tasksDir, { recursive: true });

  if (!fs.existsSync(conventionsPath)) {
    fs.copyFileSync(
      path.join(templatesDir, "ravel-conventions.md"),
      conventionsPath,
    );
  }

  writeAgentsFile(cwd, templatesDir);
  console.log("Ravel project initialized.");
}
