import { describe, expect, it } from "vitest";
import { GitWorktreeRegistry } from "./worktree.js";

describe("GitWorktreeRegistry", () => {
  it("parses NUL-delimited porcelain records and preserves custom paths", () => {
    const porcelain = [
      "worktree /repo/main checkout",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
      "worktree /custom/worktrees/task path",
      "HEAD def456",
      "branch refs/heads/T0043-add-fzf-task-picker",
      "",
      "worktree /custom/worktrees/detached",
      "HEAD fedcba",
      "detached",
      "",
      "",
    ].join("\0");

    const registry = GitWorktreeRegistry.parse(porcelain);

    expect(registry.primary.path).toBe("/repo/main checkout");
    expect(
      registry.findBranch("T0043-add-fzf-task-picker")?.path,
    ).toBe("/custom/worktrees/task path");
    expect(registry.findBranch("T0043-add-fzf-task-picker-extra")).toBeUndefined();
    expect(registry.findBranch("detached")).toBeUndefined();
  });

  it("rejects empty successful Git output", () => {
    expect(() => GitWorktreeRegistry.parse("")).toThrow(
      "Git did not report a primary worktree.",
    );
  });
});
