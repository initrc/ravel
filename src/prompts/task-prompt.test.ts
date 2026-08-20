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

const COMMIT_MESSAGE = "T0044: Generate the v2 task prompt";

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
    "identifies the task and governing instructions in the %s prompt",
    (launchMode) => {
      const prompt = promptFor(launchMode);

      expect(prompt).toContain("task T0044");
      expect(prompt).toContain(
        "ravel/tasks/T0044-generate-v2-task-prompt.md",
      );
      expect(prompt).toContain("Follow all applicable `AGENTS.md` instructions");
      expect(prompt).toContain("the task file");
      expect(prompt).toContain("Implement only the scope of T0044");
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

  it("requires a new task to transition to in-progress", () => {
    const prompt = promptFor("workmux");

    expect(prompt).toContain(
      "Before implementation, update the task status from `new` to `in-progress`.",
    );
    expect(prompt).not.toContain("This is a resumed task");
  });

  it.each([TaskPickerState.InProgress, TaskPickerState.ReviewReady])(
    "omits initial status instructions for a resumed %s task",
    (state) => {
      const prompt = promptFor("workmux", state);

      expect(prompt).not.toContain("This is a resumed task");
      expect(prompt).not.toContain(
        "Before implementation, update the task status from `new`",
      );
    },
  );

  it.each<PromptLaunchMode>(["workmux", "manual"])(
    "requires the complete pre-approval lifecycle in the %s prompt",
    (launchMode) => {
      const prompt = promptFor(launchMode);

      expect(prompt).toContain(
        "Run all verification required by the task and repository instructions",
      );
      expect(prompt).toContain("update the task status to `review`");
      expect(prompt).toContain("Do not commit or perform integration or cleanup");
      expect(prompt).toContain(
        "stop, and explicitly wait for the user to say `LGTM`",
      );
    },
  );

  it.each<PromptLaunchMode>(["workmux", "manual"])(
    "contains no Ravel-owned ready-for-review notification in the %s prompt",
    (launchMode) => {
      const prompt = promptFor(launchMode);

      expect(prompt).toContain("Report that the task is ready for review");
      expect(prompt).not.toContain("OSC 9");
      expect(prompt).not.toContain("printf");
      expect(prompt).not.toContain("$TMUX");
      expect(prompt).not.toContain("Notification failure is non-blocking");
      expect(prompt).not.toContain("ready-for-review notification");
    },
  );

  it.each<PromptLaunchMode>(["workmux", "manual"])(
    "requires done and the exact one-commit format in the %s prompt",
    (launchMode) => {
      const prompt = promptFor(launchMode);

      expect(prompt).toContain("After the user explicitly says `LGTM`");
      expect(prompt).toContain("Update the task status to `done`");
      expect(prompt).toContain("Create exactly one local commit");
      expect(prompt).toContain(COMMIT_MESSAGE);
    },
  );

  it("defines the complete approved workmux lifecycle", () => {
    const prompt = promptFor("workmux");
    const rebaseIndex = prompt.indexOf("Run `workmux rebase`");
    const verificationIndex = prompt.indexOf(
      "Run the full verification required",
      rebaseIndex,
    );
    const mergeIndex = prompt.indexOf(
      "run `workmux merge --rebase --notification`",
      verificationIndex,
    );

    expect(rebaseIndex).toBeGreaterThan(-1);
    expect(verificationIndex).toBeGreaterThan(rebaseIndex);
    expect(mergeIndex).toBeGreaterThan(verificationIndex);
    expect(prompt).toContain("run `git rebase --continue`");
    expect(prompt).toContain("Do not create another commit");
    expect(prompt).toContain("If the merge-time rebase finds newer conflicts");
    expect(prompt).toContain(
      "rerun the full verification, and retry `workmux merge --rebase --notification`",
    );
  });

  it("explains the separate rebase and narrow lifecycle exceptions", () => {
    const prompt = promptFor("workmux");

    expect(prompt).toContain(
      "could otherwise integrate and clean up the worktree before the rebased result is verified",
    );
    expect(prompt).toContain(
      "narrow, task-specific exceptions to the general Ravel convention against agent-owned merge and worktree deletion",
    );
    expect(prompt).toContain("authorized only after explicit `LGTM`");
  });

  it("leaves manual integration to the user without a workmux command", () => {
    const prompt = promptFor("manual");

    expect(prompt).toContain("Stop after the approved commit");
    expect(prompt).toContain("report the current branch name to the user");
    expect(prompt).toContain("user-owned integration and cleanup");
    expect(prompt).not.toContain("workmux");
  });

  it.each<PromptLaunchMode>(["workmux", "manual"])(
    "prohibits direct repository lifecycle commands in the %s prompt",
    (launchMode) => {
      const prompt = promptFor(launchMode);

      for (const command of [
        "`git push`",
        "`git merge`",
        "`git rebase`",
        "`git worktree remove`",
        "`git branch -d`",
      ]) {
        expect(prompt).toContain(command);
      }
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
