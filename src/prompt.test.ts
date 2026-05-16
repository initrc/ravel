import { describe, it, expect } from "vitest";
import { generatePrompt, generateLaunchCommand } from "./prompt.js";
import type { Task } from "./task.js";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "T0004",
    title: "Builder prompt generation and clipboard",
    status: "new",
    dependencies: ["T0002"],
    filename: "T0004-builder-prompt.md",
    filePath: "/fake/ravel/tasks/T0004-builder-prompt.md",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// generatePrompt
// ---------------------------------------------------------------------------
describe("generatePrompt", () => {
  it("includes the task id in the opening line", () => {
    const prompt = generatePrompt(makeTask());
    expect(prompt).toContain(
      "You are working in a git worktree for task T0004.",
    );
  });

  it("includes the correct task file path", () => {
    const prompt = generatePrompt(makeTask());
    expect(prompt).toContain("ravel/tasks/T0004-builder-prompt.md");
  });

  it("includes the commit message format with task id and title", () => {
    const prompt = generatePrompt(makeTask());
    expect(prompt).toContain("T0004: Builder prompt generation and clipboard");
  });

  it("includes review workflow instructions", () => {
    const prompt = generatePrompt(makeTask());
    expect(prompt).toContain("update the task status to review");
    expect(prompt).toContain("stop and wait for my feedback");
  });

  it("includes LGTM workflow instructions", () => {
    const prompt = generatePrompt(makeTask());
    expect(prompt).toContain("If I later say LGTM");
    expect(prompt).toContain("update the task status to done");
    expect(prompt).toContain("create exactly one local git commit");
  });

  it("includes the guard rails", () => {
    const prompt = generatePrompt(makeTask());
    expect(prompt).toContain(
      "Do not push, merge, rebase, or delete branches.",
    );
  });

  it("interpolates a different task correctly", () => {
    const prompt = generatePrompt(
      makeTask({
        id: "T0015",
        title: "Fix the flux capacitor",
        filename: "T0015-flux-capacitor.md",
      }),
    );
    expect(prompt).toContain(
      "You are working in a git worktree for task T0015.",
    );
    expect(prompt).toContain("ravel/tasks/T0015-flux-capacitor.md");
    expect(prompt).toContain("T0015: Fix the flux capacitor");
  });
});

// ---------------------------------------------------------------------------
// generateLaunchCommand
// ---------------------------------------------------------------------------
describe("generateLaunchCommand", () => {
  it("produces ravel prompt --copy && cd && builder pipeline", () => {
    const cmd = generateLaunchCommand(
      "T0003",
      "ravel",
      "/home/user/project/.worktrees/T0003",
      "claude",
    );
    expect(cmd).toBe(
      "ravel prompt T0003 --copy" +
        " && cd '/home/user/project/.worktrees/T0003'" +
        " && claude",
    );
  });

  it("supports a node path as the ravel command", () => {
    const cmd = generateLaunchCommand(
      "T0005",
      "node '/path/to/bin/ravel.js'",
      "/tmp/worktrees/T0005",
      "codex",
    );
    expect(cmd).toBe(
      "node '/path/to/bin/ravel.js' prompt T0005 --copy" +
        " && cd '/tmp/worktrees/T0005'" +
        " && codex",
    );
  });
});
