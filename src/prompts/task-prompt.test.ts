import { describe, expect, it, vi } from "vitest";
import { writeClipboard } from "../commands/clipboard.js";
import {
  ResolvedTask,
  TaskPickerState,
} from "../models/resolved-task.js";
import type { Task } from "../models/task.js";
import {
  generateTaskPrompt,
  type PromptLaunchMode,
} from "./task-prompt.js";

vi.mock("../commands/clipboard.js", () => ({
  writeClipboard: vi.fn(),
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "T0044",
    title: "Generate the v2 task prompt",
    status: "new",
    dependencies: ["T0043"],
    filename: "T0044-generate-v2-task-prompt.md",
    filePath: "/repo/ravel/tasks/T0044-generate-v2-task-prompt.md",
    ...overrides,
  };
}

function makeResolvedTask(
  state: TaskPickerState = TaskPickerState.New,
  overrides: Partial<Task> = {},
  previewPath?: string,
): ResolvedTask {
  const task = makeTask(overrides);
  return new ResolvedTask(
    task,
    "T0044-generate-v2-task-prompt",
    state,
    previewPath ?? task.filePath,
    [],
  );
}

function promptFor(
  launchMode: PromptLaunchMode,
  state: TaskPickerState = TaskPickerState.New,
): string {
  return generateTaskPrompt(
    makeResolvedTask(state),
    { mode: launchMode },
  )!;
}

describe("generateTaskPrompt", () => {
  it.each<PromptLaunchMode>(["workmux", "manual"])(
    "identifies the task and %s workflow authority",
    (launchMode) => {
      const prompt = promptFor(launchMode);

      expect(prompt).toContain("task T0044");
      expect(prompt).toContain(
        "ravel/tasks/T0044-generate-v2-task-prompt.md",
      );
      expect(prompt).toContain(`launched in \`${launchMode}\` mode`);
      expect(prompt).toContain("all applicable `AGENTS.md` instructions");
      expect(prompt).toContain("the task file");
      expect(prompt).toContain("`ravel/docs/ravel-conventions.md`");
      expect(prompt).toContain(
        `Follow the \`${launchMode}\` workflow under`,
      );
    },
  );

  it("uses the repository-relative live task filename when it was renamed", () => {
    const prompt = generateTaskPrompt(
      makeResolvedTask(
        TaskPickerState.InProgress,
        { status: "new" },
        "/custom worktree/ravel/tasks/T0044-renamed-prompt.md",
      ),
      { mode: "workmux" },
    );

    expect(prompt).toContain("ravel/tasks/T0044-renamed-prompt.md");
    expect(prompt).not.toContain("/custom worktree");
  });

  it.each([TaskPickerState.New, TaskPickerState.InProgress, TaskPickerState.ReviewReady])(
    "delegates the %s task lifecycle to the conventions document",
    (state) => {
      const prompt = promptFor("workmux", state);

      expect(prompt).not.toContain("update the task status");
      expect(prompt).not.toContain("LGTM");
      expect(prompt).not.toContain("workmux rebase");
      expect(prompt).not.toContain("git push");
    },
  );

  it.each<PromptLaunchMode>(["workmux", "manual"])(
    "does not leak runtime configuration into the %s prompt",
    (launchMode) => {
      const prompt = promptFor(launchMode);

      expect(prompt).not.toContain("main branch");
      expect(prompt).not.toContain("master branch");
      expect(prompt).not.toContain("/repo/");
      expect(prompt).not.toContain(".worktrees/");
      expect(prompt).not.toContain("claude");
      expect(prompt).not.toContain("codex");
      expect(prompt).not.toContain(".workmux.yaml");
    },
  );

  it("does not generate a new prompt for a merge-ready task", () => {
    expect(
      generateTaskPrompt(
        makeResolvedTask(TaskPickerState.MergeReady),
        { mode: "workmux" },
      ),
    ).toBeUndefined();
  });

  it("rejects a blocked task", () => {
    expect(() =>
      generateTaskPrompt(
        makeResolvedTask(TaskPickerState.Blocked),
        { mode: "manual" },
      ),
    ).toThrow("Cannot generate an implementation prompt for blocked task T0044");
  });

  it("does not access the clipboard", () => {
    generateTaskPrompt(makeResolvedTask(), { mode: "manual" });
    generateTaskPrompt(makeResolvedTask(), { mode: "workmux" });

    expect(writeClipboard).not.toHaveBeenCalled();
  });
});
