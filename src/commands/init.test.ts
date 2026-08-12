import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initCommand } from "./init.js";

describe("initCommand", () => {
  let tmpDir: string;
  let projectDir: string;
  let templatesDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ravel-init-test-"));
    projectDir = path.join(tmpDir, "project");
    templatesDir = path.join(tmpDir, "templates");
    fs.mkdirSync(projectDir);
    fs.mkdirSync(templatesDir);
    fs.writeFileSync(
      path.join(templatesDir, "AGENTS.md"),
      [
        "# AGENTS.md",
        "",
        "## Ravel Conventions",
        "",
        "Read `ravel/docs/ravel-conventions.md`.",
        "",
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(templatesDir, "ravel-conventions.md"),
      "# Test Ravel Conventions\n",
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates the v2 project structure from injected templates", () => {
    initCommand(projectDir, templatesDir);

    expect(fs.statSync(path.join(projectDir, "ravel", "docs")).isDirectory()).toBe(
      true,
    );
    expect(fs.statSync(path.join(projectDir, "ravel", "tasks")).isDirectory()).toBe(
      true,
    );
    expect(
      fs.readFileSync(
        path.join(projectDir, "ravel", "docs", "ravel-conventions.md"),
        "utf-8",
      ),
    ).toBe("# Test Ravel Conventions\n");
    expect(fs.readFileSync(path.join(projectDir, "AGENTS.md"), "utf-8")).toBe(
      [
        "# AGENTS.md",
        "",
        "## Ravel Conventions",
        "",
        "Read `ravel/docs/ravel-conventions.md`.",
        "",
      ].join("\n"),
    );
  });

  it("preserves an existing conventions file", () => {
    const docsDir = path.join(projectDir, "ravel", "docs");
    fs.mkdirSync(docsDir, { recursive: true });
    const conventionsPath = path.join(docsDir, "ravel-conventions.md");
    fs.writeFileSync(conventionsPath, "# Project-specific conventions\n");

    initCommand(projectDir, templatesDir);

    expect(fs.readFileSync(conventionsPath, "utf-8")).toBe(
      "# Project-specific conventions\n",
    );
  });

  it("appends the Ravel section while preserving existing AGENTS.md content", () => {
    fs.writeFileSync(
      path.join(projectDir, "AGENTS.md"),
      "# Project Instructions\n\nKeep this content.\n",
    );

    initCommand(projectDir, templatesDir);

    expect(fs.readFileSync(path.join(projectDir, "AGENTS.md"), "utf-8")).toBe(
      [
        "# Project Instructions",
        "",
        "Keep this content.",
        "",
        "## Ravel Conventions",
        "",
        "Read `ravel/docs/ravel-conventions.md`.",
        "",
      ].join("\n"),
    );
  });

  it("replaces only the existing Ravel section", () => {
    fs.writeFileSync(
      path.join(projectDir, "AGENTS.md"),
      [
        "# Project Instructions",
        "",
        "## Before",
        "",
        "Keep before.",
        "",
        "## Ravel Conventions",
        "",
        "Outdated instructions.",
        "",
        "### Old subsection",
        "",
        "Also outdated.",
        "",
        "## After",
        "",
        "Keep after.",
        "",
      ].join("\n"),
    );

    initCommand(projectDir, templatesDir);

    expect(fs.readFileSync(path.join(projectDir, "AGENTS.md"), "utf-8")).toBe(
      [
        "# Project Instructions",
        "",
        "## Before",
        "",
        "Keep before.",
        "",
        "## Ravel Conventions",
        "",
        "Read `ravel/docs/ravel-conventions.md`.",
        "",
        "## After",
        "",
        "Keep after.",
        "",
      ].join("\n"),
    );
  });

  it("preserves a top-level heading after the Ravel section", () => {
    fs.writeFileSync(
      path.join(projectDir, "AGENTS.md"),
      [
        "# Project Instructions",
        "",
        "## Ravel Conventions",
        "",
        "Outdated instructions.",
        "",
        "# Project Notes",
        "",
        "Keep these notes.",
        "",
      ].join("\n"),
    );

    initCommand(projectDir, templatesDir);

    expect(fs.readFileSync(path.join(projectDir, "AGENTS.md"), "utf-8")).toBe(
      [
        "# Project Instructions",
        "",
        "## Ravel Conventions",
        "",
        "Read `ravel/docs/ravel-conventions.md`.",
        "",
        "# Project Notes",
        "",
        "Keep these notes.",
        "",
      ].join("\n"),
    );
  });

  it("is idempotent", () => {
    initCommand(projectDir, templatesDir);
    const agentsPath = path.join(projectDir, "AGENTS.md");
    const firstAgentsContent = fs.readFileSync(agentsPath, "utf-8");

    initCommand(projectDir, templatesDir);

    expect(fs.readFileSync(agentsPath, "utf-8")).toBe(firstAgentsContent);
  });

  it("does not create or modify v1 project state", () => {
    const gitignorePath = path.join(projectDir, ".gitignore");
    fs.writeFileSync(gitignorePath, "node_modules/\n");

    initCommand(projectDir, templatesDir);

    expect(fs.existsSync(path.join(projectDir, ".ravel"))).toBe(false);
    expect(fs.existsSync(path.join(projectDir, ".worktrees"))).toBe(false);
    expect(fs.readFileSync(gitignorePath, "utf-8")).toBe("node_modules/\n");
  });
});
