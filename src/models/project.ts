import * as fs from "node:fs";
import * as path from "node:path";

const RAVEL_DIRECTORY = "ravel";
const DOCS_DIRECTORY = "docs";
const TASKS_DIRECTORY = "tasks";
const CONVENTIONS_FILENAME = "ravel-conventions.md";

export class RavelProject {
  readonly docsDir: string;
  readonly tasksDir: string;
  readonly conventionsPath: string;

  constructor(readonly root: string) {
    const ravelDir = path.join(root, RAVEL_DIRECTORY);
    this.docsDir = path.join(ravelDir, DOCS_DIRECTORY);
    this.tasksDir = path.join(ravelDir, TASKS_DIRECTORY);
    this.conventionsPath = path.join(this.docsDir, CONVENTIONS_FILENAME);
  }

  taskPath(filename: string): string {
    return path.join(this.tasksDir, filename);
  }

  static discover(startDirectory: string): RavelProject | undefined {
    let directory = path.resolve(startDirectory);

    while (true) {
      const project = new RavelProject(directory);
      if (isDirectory(project.tasksDir)) {
        return project;
      }

      const parent = path.dirname(directory);
      if (parent === directory) {
        return undefined;
      }
      directory = parent;
    }
  }
}

function isDirectory(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}
