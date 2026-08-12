import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import { runCli } from "./ravel.js";

describe("runCli", () => {
  let tmpDir: string;
  let projectDir: string;
  let templatesDir: string;
  let log: Mock<typeof console.log>;
  let error: Mock<typeof console.error>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ravel-cli-test-"));
    projectDir = path.join(tmpDir, "project");
    templatesDir = path.join(tmpDir, "templates");
    fs.mkdirSync(projectDir);
    fs.mkdirSync(templatesDir);
    fs.writeFileSync(
      path.join(templatesDir, "AGENTS.md"),
      "# AGENTS.md\n\n## Ravel Conventions\n\nTest instructions.\n",
    );
    fs.writeFileSync(
      path.join(templatesDir, "ravel-conventions.md"),
      "# Ravel Conventions\n",
    );
    log = vi.fn<typeof console.log>();
    error = vi.fn<typeof console.error>();
    vi.spyOn(console, "log").mockImplementation(log);
    vi.spyOn(console, "error").mockImplementation(error);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("prints help for --help", () => {
    expect(runCli(["--help"], projectDir, templatesDir)).toBe(0);

    const output = String(log.mock.calls[0]?.[0]);
    expect(output).toContain("Usage: ravel [init|doctor|--help|--version]");
    expect(output).toContain("init");
    expect(output).toContain("doctor");
    expect(output).not.toContain("assign");
    expect(output).not.toContain("integrate");
  });

  it("prints the package version for --version", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(import.meta.dirname, "..", "package.json"), "utf-8"),
    ) as { version: string };

    expect(runCli(["--version"], projectDir, templatesDir)).toBe(0);
    expect(log).toHaveBeenCalledWith(packageJson.version);
  });

  it("routes init with the current directory and injected templates", () => {
    expect(runCli(["init"], projectDir, templatesDir)).toBe(0);

    expect(
      fs.existsSync(path.join(projectDir, "ravel", "docs", "ravel-conventions.md")),
    ).toBe(true);
  });

  it("leaves bare ravel as the T0043 handoff", () => {
    expect(runCli([], projectDir, templatesDir)).toBe(1);
    expect(error).toHaveBeenCalledWith(
      "The Ravel task picker workflow arrives in T0043.",
    );
  });

  it("leaves doctor as the T0042 handoff", () => {
    expect(runCli(["doctor"], projectDir, templatesDir)).toBe(1);
    expect(error).toHaveBeenCalledWith("The Ravel doctor workflow arrives in T0042.");
  });

  it.each([["assign"], ["--unknown"], ["init", "extra"], ["--help", "extra"]])(
    "rejects unsupported arguments: %s",
    (...args) => {
      expect(runCli(args, projectDir, templatesDir)).toBe(1);
      expect(error).toHaveBeenCalledWith(
        "Usage: ravel [init|doctor|--help|--version]",
      );
    },
  );
});
