import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const PROJECT_ROOT = path.join(import.meta.dirname, "..");

const PUBLISHED_FILES = [
  "LICENSE",
  "README.md",
  "bin/commands/clipboard.d.ts",
  "bin/commands/clipboard.js",
  "bin/commands/init.d.ts",
  "bin/commands/init.js",
  "bin/commands/process.d.ts",
  "bin/commands/process.js",
  "bin/doctor/check.d.ts",
  "bin/doctor/check.js",
  "bin/doctor/checks/fzf.d.ts",
  "bin/doctor/checks/fzf.js",
  "bin/doctor/checks/git.d.ts",
  "bin/doctor/checks/git.js",
  "bin/doctor/checks/tmux.d.ts",
  "bin/doctor/checks/tmux.js",
  "bin/doctor/checks/workmux.d.ts",
  "bin/doctor/checks/workmux.js",
  "bin/doctor/doctor.d.ts",
  "bin/doctor/doctor.js",
  "bin/models/project.d.ts",
  "bin/models/project.js",
  "bin/models/resolved-task.d.ts",
  "bin/models/resolved-task.js",
  "bin/models/task.d.ts",
  "bin/models/task.js",
  "bin/models/worktree.d.ts",
  "bin/models/worktree.js",
  "bin/prompts/task-prompt.d.ts",
  "bin/prompts/task-prompt.js",
  "bin/ravel.d.ts",
  "bin/ravel.js",
  "bin/task-launcher.d.ts",
  "bin/task-launcher.js",
  "bin/task-picker.d.ts",
  "bin/task-picker.js",
  "bin/templates/AGENTS.md",
  "bin/templates/ravel-conventions.md",
  "package.json",
].sort();

interface PackResult {
  name: string;
  version: string;
  files: Array<{ path: string }>;
}

describe("published package", () => {
  let npmCache: string | undefined;

  afterEach(() => {
    if (npmCache) {
      fs.rmSync(npmCache, { recursive: true, force: true });
      npmCache = undefined;
    }
  });

  it("contains only the intended v2 runtime at version 2.0.0", () => {
    npmCache = fs.mkdtempSync(path.join(os.tmpdir(), "ravel-pack-cache-"));
    const pack = spawnSync(
      "npm",
      [
        "pack",
        "--dry-run",
        "--json",
        "--ignore-scripts",
        "--cache",
        npmCache,
      ],
      { cwd: PROJECT_ROOT, encoding: "utf8" },
    );

    expect(pack.status, pack.stderr).toBe(0);
    const [result] = JSON.parse(pack.stdout) as PackResult[];
    expect(result).toMatchObject({ name: "@initrc/ravel", version: "2.0.0" });
    expect(result.files.map((file) => file.path).sort()).toEqual(PUBLISHED_FILES);
  });

  it("keeps the public binary and only the intended runtime dependencies", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8"),
    ) as {
      bin: Record<string, string>;
      dependencies: Record<string, string>;
    };

    expect(packageJson.bin).toEqual({ ravel: "bin/ravel.js" });
    expect(Object.keys(packageJson.dependencies).sort()).toEqual([
      "clipboardy",
      "gray-matter",
      "zod",
    ]);
  });
});
