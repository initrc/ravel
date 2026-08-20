import * as fs from "node:fs";
import * as path from "node:path";
import { RavelProject } from "./project.js";
import { parseTask, type Task, TaskCollection } from "./task.js";
import type { GitWorktreeRegistry } from "./worktree.js";

export enum TaskPickerState {
  MergeReady = "merge-ready",
  ReviewReady = "review-ready",
  InProgress = "in-progress",
  New = "new",
  Blocked = "blocked",
}

const STATE_ORDER: Record<TaskPickerState, number> = {
  [TaskPickerState.MergeReady]: 0,
  [TaskPickerState.ReviewReady]: 1,
  [TaskPickerState.InProgress]: 2,
  [TaskPickerState.New]: 3,
  [TaskPickerState.Blocked]: 4,
};

export class ResolvedTask {
  constructor(
    readonly task: Task,
    readonly branchName: string,
    readonly state: TaskPickerState,
    readonly previewPath: string,
    readonly incompleteDependencies: readonly Task[],
    readonly worktreePath?: string,
  ) {}
}

export class ResolvedTaskCollection {
  private constructor(
    readonly taskCollection: TaskCollection,
    readonly tasks: readonly ResolvedTask[],
  ) {}

  static resolve(
    taskCollection: TaskCollection,
    worktreeRegistry?: GitWorktreeRegistry,
  ): ResolvedTaskCollection {
    const resolved = taskCollection.list().map((task) => {
      const branchName = ResolvedTaskCollection.branchNameFor(task);
      const worktree = worktreeRegistry?.findBranch(branchName);
      let liveTask: Task | undefined;
      let previewPath = task.filePath;

      if (worktree) {
        previewPath = ResolvedTaskCollection.findWorktreeTaskPath(
          task,
          branchName,
          worktree.path,
        );
        liveTask = parseTask(previewPath);
      }

      if (task.status === "done") {
        return undefined;
      }

      return new ResolvedTask(
        task,
        branchName,
        resolveState(task, liveTask, taskCollection),
        previewPath,
        task.dependencies
          .map((dependencyId) => taskCollection.get(dependencyId))
          .filter(
            (dependency): dependency is Task => dependency?.status !== "done",
          ),
        worktree?.path,
      );
    });

    return new ResolvedTaskCollection(
      taskCollection,
      resolved
        .filter((task): task is ResolvedTask => task !== undefined)
        .sort(
          (left, right) =>
            STATE_ORDER[left.state] - STATE_ORDER[right.state] ||
            left.task.id.localeCompare(right.task.id),
        ),
    );
  }

  private static branchNameFor(task: Task): string {
    return task.filename.slice(0, -path.extname(task.filename).length);
  }

  private static findWorktreeTaskPath(
    task: Task,
    branchName: string,
    worktreePath: string,
  ): string {
    const worktreeProject = new RavelProject(worktreePath);
    const expectedPath = worktreeProject.taskPath(task.filename);
    if (fs.existsSync(expectedPath)) {
      return expectedPath;
    }

    const renamedTaskPaths = fs.existsSync(worktreeProject.tasksDir)
      ? fs
          .readdirSync(worktreeProject.tasksDir, { withFileTypes: true })
          .filter(
            (entry) =>
              entry.isFile() &&
              entry.name.startsWith(`${task.id}-`) &&
              entry.name.endsWith(".md"),
          )
          .map((entry) => worktreeProject.taskPath(entry.name))
      : [];

    if (renamedTaskPaths.length === 1) {
      return renamedTaskPaths[0];
    }
    if (renamedTaskPaths.length > 1) {
      throw new Error(
        `Worktree for branch ${branchName} at ${worktreePath} has multiple task files for ${task.id}: ${renamedTaskPaths.join(", ")}`,
      );
    }
    throw new Error(
      `Worktree for branch ${branchName} at ${worktreePath} has no task file for ${task.id}: ${expectedPath}`,
    );
  }
}

function resolveState(
  task: Task,
  liveTask: Task | undefined,
  taskCollection: TaskCollection,
): TaskPickerState {
  if (liveTask?.status === "done") {
    return TaskPickerState.MergeReady;
  }
  if (liveTask?.status === "review") {
    return TaskPickerState.ReviewReady;
  }
  if (liveTask?.status === "in-progress") {
    return TaskPickerState.InProgress;
  }
  if (task.status === "review") {
    return TaskPickerState.ReviewReady;
  }
  if (task.status === "in-progress") {
    return TaskPickerState.InProgress;
  }
  return taskCollection.isBlocked(task)
    ? TaskPickerState.Blocked
    : TaskPickerState.New;
}
