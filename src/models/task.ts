import * as fs from "node:fs";
import * as path from "node:path";
import matter from "gray-matter";
import { z } from "zod";

const TaskFrontmatterSchema = z.object({
  id: z.string().regex(/^T\d{4,}$/, "Task ID must be T followed by at least 4 digits"),
  title: z.string().min(1),
  status: z.enum(["new", "in-progress", "review", "done"]),
  dependencies: z.array(z.string()).default([]),
});

export interface Task {
  id: string;
  title: string;
  status: "new" | "in-progress" | "review" | "done";
  dependencies: string[];
  filename: string;
  filePath: string;
}

export function parseFilename(filename: string): { id: string; slug: string } | null {
  const match = filename.match(/^(T\d{4,})-(.+)\.md$/);
  if (!match) return null;
  return { id: match[1], slug: match[2] };
}

export function parseTask(filePath: string): Task {
  const filename = path.basename(filePath);
  const parsed = parseFilename(filename);
  if (!parsed) {
    throw new Error(
      `Invalid task filename: "${filename}". Expected format: T0001-slug.md`
    );
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const gm = matter(content);

  const result = TaskFrontmatterSchema.safeParse(gm.data);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid frontmatter in ${filename}:\n${issues}`);
  }

  const frontmatter = result.data;
  if (frontmatter.id !== parsed.id) {
    throw new Error(
      `Task ID mismatch in ${filename}: frontmatter has "${frontmatter.id}" but filename has "${parsed.id}"`
    );
  }

  return {
    id: frontmatter.id,
    title: frontmatter.title,
    status: frontmatter.status,
    dependencies: frontmatter.dependencies,
    filename,
    filePath,
  };
}

export class TaskCollection {
  private tasks: Map<string, Task>;

  constructor(tasks: Task[]) {
    this.tasks = new Map(tasks.map((t) => [t.id, t]));
  }

  static load(tasksDir: string): TaskCollection {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(tasksDir, { withFileTypes: true });
    } catch {
      throw new Error(`Tasks directory not found: ${tasksDir}`);
    }

    const tasks: Task[] = [];
    const errors: string[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const filePath = path.join(tasksDir, entry.name);
      try {
        tasks.push(parseTask(filePath));
      } catch (err) {
        errors.push((err as Error).message);
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Failed to parse ${errors.length} task(s):\n${errors.join("\n")}`
      );
    }

    // Validate all dependency references exist
    const ids = new Set(tasks.map((t) => t.id));
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        if (!ids.has(depId)) {
          throw new Error(
            `Task ${task.id} depends on ${depId}, but ${depId} was not found`
          );
        }
      }
    }

    return new TaskCollection(tasks);
  }

  get(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  list(): Task[] {
    return [...this.tasks.values()];
  }

  isBlocked(task: Task): boolean {
    return (
      task.status === "new" &&
      task.dependencies.some((depId) => {
        const dep = this.tasks.get(depId);
        return dep && dep.status !== "done";
      })
    );
  }

  getBlockedTasks(): Task[] {
    return this.list().filter((t) => this.isBlocked(t));
  }

  getByStatus(status: string): Task[] {
    return this.list().filter((t) => t.status === status);
  }

  getDependents(taskId: string): Task[] {
    return this.list().filter((t) => t.dependencies.includes(taskId));
  }
}

export function updateTaskStatus(filePath: string, newStatus: string): void {
  const content = fs.readFileSync(filePath, "utf-8");
  const gm = matter(content);
  gm.data.status = newStatus;
  fs.writeFileSync(filePath, matter.stringify(gm.content, gm.data));
}
