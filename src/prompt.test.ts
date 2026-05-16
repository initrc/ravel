import { describe, it, expect } from "vitest";
import { generatePrompt } from "./prompt";
import type { Task } from "./task";

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
