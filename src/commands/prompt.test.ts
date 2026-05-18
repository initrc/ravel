import { describe, it, expect } from "vitest";
import { generatePrompt, generateLaunchCommand } from "./prompt.js";
import type { Task } from "../models/task.js";

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
    const prompt = generatePrompt(makeTask(), "main");
    expect(prompt).toContain(
      "You are working in a git worktree for task T0004.",
    );
  });

  it("includes the correct task file path", () => {
    const prompt = generatePrompt(makeTask(), "main");
    expect(prompt).toContain("ravel/tasks/T0004-builder-prompt.md");
  });

  it("includes the commit message format with task id and title", () => {
    const prompt = generatePrompt(makeTask(), "main");
    expect(prompt).toContain("T0004: Builder prompt generation and clipboard");
  });

  it("includes review workflow instructions", () => {
    const prompt = generatePrompt(makeTask(), "main");
    expect(prompt).toContain("update the task status to review");
    expect(prompt).toContain("stop and wait for my feedback");
  });

  it("includes LGTM workflow instructions", () => {
    const prompt = generatePrompt(makeTask(), "main");
    expect(prompt).toContain("If I later say LGTM");
    expect(prompt).toContain("update the task status to done");
    expect(prompt).toContain("create exactly one local git commit");
  });

  it("includes rebase instruction in LGTM flow", () => {
    const prompt = generatePrompt(makeTask(), "main");
    expect(prompt).toContain("- rebase onto the main branch");
    expect(prompt).toContain(
      "- resolve any conflicts from the rebase and verify the build, all tests and lint passed",
    );
  });

  it("does not include the old guard rail about not rebasing", () => {
    const prompt = generatePrompt(makeTask(), "main");
    expect(prompt).not.toContain("Do not push, merge, rebase, or delete branches");
  });

  it("interpolates the main branch name in the rebase instruction", () => {
    const prompt = generatePrompt(makeTask(), "master");
    expect(prompt).toContain("- rebase onto the master branch");
    expect(prompt).toContain(
      "- resolve any conflicts from the rebase and verify the build, all tests and lint passed",
    );
  });

  it("interpolates a different task correctly", () => {
    const prompt = generatePrompt(
      makeTask({
        id: "T0015",
        title: "Fix the flux capacitor",
        filename: "T0015-flux-capacitor.md",
      }),
      "main",
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
  it("produces cd project && ravel prompt --copy && cd worktree && builder pipeline", () => {
    const cmd = generateLaunchCommand(
      "T0003",
      "ravel",
      "/home/user/project",
      "/home/user/project/.worktrees/T0003",
      "claude",
    );
    expect(cmd).toBe(
      "cd '/home/user/project'" +
        " && ravel prompt T0003 --copy" +
        " && cd '.worktrees/T0003'" +
        " && claude",
    );
  });

  it("supports a node path as the ravel command", () => {
    const cmd = generateLaunchCommand(
      "T0005",
      "node '/path/to/bin/ravel.js'",
      "/tmp",
      "/tmp/worktrees/T0005",
      "codex",
    );
    expect(cmd).toBe(
      "cd '/tmp'" +
        " && node '/path/to/bin/ravel.js' prompt T0005 --copy" +
        " && cd 'worktrees/T0005'" +
        " && codex",
    );
  });
});
