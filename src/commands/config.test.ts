import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { ConfigSchema, DEFAULT_CONFIG, requireInit } from "./config.js";

describe("ConfigSchema", () => {
  it("parses a full valid config", () => {
    const result = ConfigSchema.parse({
      agentCommand: "codex",
      copyCommandByDefault: true,
      mainBranch: "develop",
    });
    expect(result.agentCommand).toBe("codex");
    expect(result.copyCommandByDefault).toBe(true);
    expect(result.mainBranch).toBe("develop");
  });

  it("applies all defaults when given an empty object", () => {
    const result = ConfigSchema.parse({});
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  it("applies partial defaults", () => {
    const result = ConfigSchema.parse({ mainBranch: "develop" });
    expect(result.mainBranch).toBe("develop");
    expect(result.agentCommand).toBe("claude");
    expect(result.copyCommandByDefault).toBe(false);
  });

  it("rejects a non-string agentCommand", () => {
    expect(() => ConfigSchema.parse({ agentCommand: 123 })).toThrow();
  });

  it("rejects a non-boolean flag", () => {
    expect(() => ConfigSchema.parse({ copyCommandByDefault: "yes" })).toThrow();
  });
});

describe("DEFAULT_CONFIG", () => {
  it("matches the config schema", () => {
    expect(() => ConfigSchema.parse(DEFAULT_CONFIG)).not.toThrow();
  });

  it("has the expected defaults", () => {
    expect(DEFAULT_CONFIG).toEqual({
      agentCommand: "claude",
      copyCommandByDefault: false,
      mainBranch: "main",
      testCommand: "npm test",
      notifyWhenDone: true,
    });
  });
});

describe("requireInit", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join("/tmp", "ravel-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("exits with code 1 when .ravel/config.json is missing", () => {
    const exitMock = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const errorMock = vi.spyOn(console, "error").mockImplementation(() => {});

    requireInit(tmpDir);

    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errorMock).toHaveBeenCalled();

    exitMock.mockRestore();
    errorMock.mockRestore();
  });

  it("does not throw when .ravel/config.json exists", () => {
    fs.mkdirSync(path.join(tmpDir, ".ravel"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".ravel", "config.json"),
      JSON.stringify(DEFAULT_CONFIG),
    );

    expect(() => requireInit(tmpDir)).not.toThrow();
  });
});
