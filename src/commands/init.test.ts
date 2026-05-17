import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { initCommand } from "./init.js";

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(thisDir, "..", "..", "templates");

describe("initCommand", () => {
  let tmpDir: string;
  let consoleLog: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join("/tmp", "ravel-test-"));
    consoleLog = vi.fn();
    vi.spyOn(console, "log").mockImplementation(consoleLog as unknown as (...args: unknown[]) => void);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("directory structure", () => {
    it("creates all required directories", () => {
      initCommand(tmpDir, templatesDir);

      expect(fs.existsSync(path.join(tmpDir, "ravel", "docs"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "ravel", "tasks"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".ravel", "sessions"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".ravel", "logs"))).toBe(true);
    });
  });

  describe(".ravel/config.json", () => {
    it("writes config with default values", () => {
      initCommand(tmpDir, templatesDir);

      const configPath = path.join(tmpDir, ".ravel", "config.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
      expect(config.builderCommand).toBe("claude");
      expect(config.copyCommandByDefault).toBe(false);
    });
  });

  describe("ravel-conventions.md", () => {
    it("copies conventions template to ravel/docs", () => {
      initCommand(tmpDir, templatesDir);

      const dest = path.join(tmpDir, "ravel", "docs", "ravel-conventions.md");
      expect(fs.existsSync(dest)).toBe(true);
      const content = fs.readFileSync(dest, "utf-8");
      expect(content).toContain("# Ravel Conventions");
      expect(content).toContain("ravel/tasks/");
    });
  });

  describe(".gitignore", () => {
    it("creates .gitignore with required entries", () => {
      initCommand(tmpDir, templatesDir);

      const gitignore = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
      expect(gitignore).toContain(".ravel/");
      expect(gitignore).toContain(".worktrees/");
    });

    it("does not duplicate entries when .gitignore already has them", () => {
      fs.writeFileSync(path.join(tmpDir, ".gitignore"), ".ravel/\n.worktrees/\n");

      initCommand(tmpDir, templatesDir);

      const gitignore = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
      const count = (gitignore.match(/\.ravel\//g) || []).length;
      expect(count).toBe(1);
    });

    it("preserves existing .gitignore content", () => {
      fs.writeFileSync(path.join(tmpDir, ".gitignore"), "node_modules/\n");

      initCommand(tmpDir, templatesDir);

      const gitignore = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
      expect(gitignore).toContain("node_modules/");
      expect(gitignore).toContain(".ravel/");
    });
  });

  describe("idempotency", () => {
    it("does not overwrite existing config on second run", () => {
      initCommand(tmpDir, templatesDir);

      const configPath = path.join(tmpDir, ".ravel", "config.json");
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          builderCommand: "claude",
          copyCommandByDefault: false,
          mainBranch: "develop",
        }),
      );

      initCommand(tmpDir, templatesDir);

      const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
      expect(config.mainBranch).toBe("develop");
    });

    it("does not overwrite existing conventions file", () => {
      const conventionsDir = path.join(tmpDir, "ravel", "docs");
      fs.mkdirSync(conventionsDir, { recursive: true });
      const conventionsPath = path.join(conventionsDir, "ravel-conventions.md");
      fs.writeFileSync(conventionsPath, "custom conventions content");

      initCommand(tmpDir, templatesDir);

      expect(fs.readFileSync(conventionsPath, "utf-8")).toBe("custom conventions content");
    });
  });

  describe("already initialized", () => {
    it("prints message and exits early when config already exists", () => {
      fs.mkdirSync(path.join(tmpDir, ".ravel"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, ".ravel", "config.json"),
        JSON.stringify({ builderCommand: "claude" }),
      );

      initCommand(tmpDir, templatesDir);

      expect(consoleLog).toHaveBeenCalledWith("Ravel is already initialized.");
      // Should not create the task directory
      expect(fs.existsSync(path.join(tmpDir, "ravel", "tasks"))).toBe(false);
    });
  });

  describe("AGENTS.md generation", () => {
    it("creates AGENTS.md from template when it does not exist", () => {
      initCommand(tmpDir, templatesDir);

      const content = fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf-8");
      expect(content).toContain("## Ravel Conventions");
      expect(content).toContain("ravel/docs/ravel-conventions.md");
    });

    it("appends Ravel Conventions section when AGENTS.md exists without it", () => {
      fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "# My Project\n\nSome project content\n");

      initCommand(tmpDir, templatesDir);

      const content = fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf-8");
      expect(content).toContain("# My Project");
      expect(content).toContain("## Ravel Conventions");
    });

    it("replaces existing Ravel Conventions section on re-init", () => {
      fs.writeFileSync(
        path.join(tmpDir, "AGENTS.md"),
        [
          "# My Project",
          "",
          "## Ravel Conventions",
          "Old conventions content",
          "",
          "## Other Section",
          "More content",
        ].join("\n"),
      );

      initCommand(tmpDir, templatesDir);

      const content = fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf-8");
      expect(content).toContain("# My Project");
      expect(content).toContain("## Ravel Conventions");
      expect(content).toContain("## Other Section");
      expect(content).toContain("More content");
      expect(content).not.toContain("Old conventions content");
    });
  });
});
