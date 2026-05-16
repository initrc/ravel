import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { ConfigSchema, DEFAULT_CONFIG, requireInit } from "./config.js";

describe("ConfigSchema", () => {
  it("parses a full valid config", () => {
    const result = ConfigSchema.parse({
      builderCommand: "codex",
      copyCommandByDefault: true,
      maxConcurrentBuilders: 4,
    });
    expect(result.builderCommand).toBe("codex");
    expect(result.copyCommandByDefault).toBe(true);
    expect(result.maxConcurrentBuilders).toBe(4);
  });

  it("applies all defaults when given an empty object", () => {
    const result = ConfigSchema.parse({});
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  it("applies partial defaults", () => {
    const result = ConfigSchema.parse({ maxConcurrentBuilders: 8 });
    expect(result.maxConcurrentBuilders).toBe(8);
    expect(result.builderCommand).toBe("claude");
    expect(result.copyCommandByDefault).toBe(false);
  });

  it("rejects non-integer maxConcurrentBuilders", () => {
    expect(() => ConfigSchema.parse({ maxConcurrentBuilders: 1.5 })).toThrow();
  });

  it("rejects maxConcurrentBuilders less than 1", () => {
    expect(() => ConfigSchema.parse({ maxConcurrentBuilders: 0 })).toThrow();
  });

  it("rejects maxConcurrentBuilders of 0", () => {
    expect(() => ConfigSchema.parse({ maxConcurrentBuilders: 0 })).toThrow();
  });

  it("rejects a non-string builderCommand", () => {
    expect(() => ConfigSchema.parse({ builderCommand: 123 })).toThrow();
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
      builderCommand: "claude",
      copyCommandByDefault: false,
      maxConcurrentBuilders: 2,
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
