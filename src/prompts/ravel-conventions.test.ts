import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = path.join(import.meta.dirname, "../..");
const TEMPLATE_PATH = path.join(
  PROJECT_ROOT,
  "templates",
  "ravel-conventions.md",
);
const PROJECT_CONVENTIONS_PATH = path.join(
  PROJECT_ROOT,
  "ravel",
  "docs",
  "ravel-conventions.md",
);
const AGENTS_TEMPLATE_PATH = path.join(PROJECT_ROOT, "templates", "AGENTS.md");
const conventions = fs.readFileSync(TEMPLATE_PATH, "utf8");

describe("Ravel conventions template", () => {
  it("defines the shared task lifecycle in order", () => {
    const inProgressIndex = conventions.indexOf("update it to `in-progress`");
    const verificationIndex = conventions.indexOf("Run all verification required");
    const reviewIndex = conventions.indexOf("update the task status to `review`");
    const approvalIndex = conventions.indexOf(
      "Only after receiving explicit `LGTM`",
    );
    const doneIndex = conventions.indexOf("update the task status to `done`");
    const commitIndex = conventions.indexOf(
      "create exactly one local commit",
    );

    expect(inProgressIndex).toBeGreaterThan(-1);
    expect(verificationIndex).toBeGreaterThan(inProgressIndex);
    expect(reviewIndex).toBeGreaterThan(verificationIndex);
    expect(approvalIndex).toBeGreaterThan(reviewIndex);
    expect(doneIndex).toBeGreaterThan(approvalIndex);
    expect(commitIndex).toBeGreaterThan(doneIndex);
    expect(conventions).toContain("T0003: Apply shadcn ui primitives");
    expect(conventions).toContain(
      "Before explicit `LGTM`, do not commit, push, rebase, merge",
    );
  });

  it("defines the approved workmux lifecycle and direct Git restrictions", () => {
    const rebaseIndex = conventions.indexOf("Run `workmux rebase`");
    const verificationIndex = conventions.indexOf(
      "Run the full verification required",
      rebaseIndex,
    );
    const mergeIndex = conventions.indexOf(
      "`workmux merge --rebase --notification`",
      verificationIndex,
    );

    expect(rebaseIndex).toBeGreaterThan(-1);
    expect(verificationIndex).toBeGreaterThan(rebaseIndex);
    expect(mergeIndex).toBeGreaterThan(verificationIndex);
    expect(conventions).toContain("`git rebase --continue`. Do not create");
    expect(conventions).toContain("Do not create another commit");
    expect(conventions).toContain("If that command finds newer conflicts");
    expect(conventions).toContain(
      "Use `git rebase --continue` only to resolve conflicts",
    );
  });

  it("leaves manual integration and cleanup to the user", () => {
    const manualWorkflow = conventions.slice(
      conventions.indexOf("### `manual` workflow"),
    );

    expect(manualWorkflow).toContain("report the current\nbranch name");
    expect(manualWorkflow).toContain("Integration and cleanup belong to the user");
    expect(manualWorkflow).not.toContain("`workmux ");
    for (const command of [
      "`git push`",
      "`git rebase`",
      "`git merge`",
      "`git worktree remove`",
      "`git branch -d`",
    ]) {
      expect(manualWorkflow).toContain(command);
    }
  });

  it("matches the conventions used by Ravel's own repository", () => {
    expect(fs.readFileSync(PROJECT_CONVENTIONS_PATH, "utf8")).toBe(conventions);
  });

  it("is required by the generated agent instructions for implementation", () => {
    const agentsTemplate = fs.readFileSync(AGENTS_TEMPLATE_PATH, "utf8");

    expect(agentsTemplate).toContain("Before implementing a task");
    expect(agentsTemplate).toContain("`ravel/docs/ravel-conventions.md`");
  });
});
