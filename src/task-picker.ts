import {
  type CommandRunner,
  SystemCommandRunner,
} from "./commands/process.js";
import { RavelProject } from "./models/project.js";
import {
  ResolvedTask,
  ResolvedTaskCollection,
  TaskPickerState,
} from "./models/resolved-task.js";
import { TaskCollection } from "./models/task.js";
import { GitWorktreeRegistry } from "./models/worktree.js";

const FZF_CANCEL_EXIT_STATUS = 130;
const PICKER_HEADER = "Enter: select task | Escape: cancel";
const STATUS_COLUMN_WIDTH = TaskPickerState.ReviewReady.length;
const MINIMUM_TASK_ID_LENGTH = "T0000".length;
const COLUMN_GAP = "  ";
const SHELL_SINGLE_QUOTE_ESCAPE = "'\"'\"'";

/** Loads a task collection and presents its open tasks in fzf. */
export class TaskPicker {
  constructor(private readonly commands: CommandRunner) {}

  pick(startDirectory: string): ResolvedTask | undefined {
    // The current project is the nearest initialized Ravel project around cwd.
    // It may be a primary worktree, linked worktree, or non-Git directory.
    const currentProject = RavelProject.discover(startDirectory);
    if (!currentProject) {
      throw new Error("Ravel is not initialized here. Run `ravel init`.");
    }

    const worktreeRegistry = this.loadWorktreeRegistry(currentProject.root);
    // The task project identifies which checkout supplies the task collection.
    // Git points linked worktrees back to its primary; otherwise use the current one.
    const taskProject = worktreeRegistry
      ? new RavelProject(worktreeRegistry.primary.path)
      : currentProject;
    const taskCollection = TaskCollection.load(taskProject.tasksDir);
    const resolvedTasks = ResolvedTaskCollection.resolve(
      taskCollection,
      worktreeRegistry,
    );

    if (resolvedTasks.tasks.length === 0) {
      console.log("No open tasks.");
      return undefined;
    }

    return this.runFzf(resolvedTasks, currentProject.root);
  }

  /** Returns no registry when Git is unavailable or the project is not a Git repo. */
  private loadWorktreeRegistry(
    projectRoot: string,
  ): GitWorktreeRegistry | undefined {
    const result = this.commands.run(
      "git",
      ["worktree", "list", "--porcelain", "-z"],
      { cwd: projectRoot },
    );
    if (result.status !== 0) {
      return undefined;
    }
    return GitWorktreeRegistry.parse(result.stdout);
  }

  /**
   * Sends rows such as `0\tnew  T0001  Add picker` to fzf, where `\t` is one
   * tab. The tab delimiter splits field 1 (`0`, the hidden selection key) from
   * field 2 (`new  T0001  Add picker`, the visible and searchable text). fzf
   * returns the original selected row, allowing key `0` to select tasks[0].
   */
  private runFzf(
    tasks: ResolvedTaskCollection,
    projectRoot: string,
  ): ResolvedTask | undefined {
    const rows = tasks.tasks.map((task, index) => formatRow(task, index));
    const result = this.commands.run(
      "fzf",
      [
        // Preserve the merge-ready/review-ready/in-progress/new/blocked grouping.
        "--no-sort",
        // Keep the two available actions visible above the task list.
        `--header=${PICKER_HEADER}`,
        // Split each row at its tab into hidden key field 1 and visible field 2.
        "--delimiter=\t",
        // Display fields 2 through the last field, hiding the numeric key.
        "--with-nth=2..",
        // Show the complete resolved task file for the highlighted row.
        `--preview=${previewCommand(tasks.tasks)}`,
      ],
      {
        cwd: projectRoot,
        input: `${rows.join("\n")}\n`,
        inheritStderr: true,
      },
    );

    // `0\tnew ...\n` or `0\tnew ...\r\n` becomes the original row without EOL.
    const selectedRow = firstLine(result.stdout);
    if (
      selectedRow === "" &&
      (result.status === 0 || result.status === FZF_CANCEL_EXIT_STATUS)
    ) {
      return undefined;
    }
    if (result.status !== 0) {
      const detail = result.error?.message ?? result.stderr.trim();
      throw new Error(
        detail
          ? `fzf failed: ${detail}`
          : `fzf exited with status ${String(result.status)}.`,
      );
    }

    const separator = selectedRow.indexOf("\t");
    const selectionKey = separator === -1
      ? selectedRow
      : selectedRow.slice(0, separator);
    // Generated keys contain decimal digits only: `12` is valid; `12x` is not.
    if (!/^\d+$/.test(selectionKey)) {
      throw new Error("fzf returned an invalid task selection.");
    }

    const selectedTask = tasks.tasks[Number(selectionKey)];
    if (!selectedTask) {
      throw new Error("fzf returned an unknown task selection.");
    }
    return selectedTask;
  }
}

export const taskPicker = new TaskPicker(new SystemCommandRunner());

/** `index=0`, `state=new`, and `id=T0001` becomes `0\tnew ... T0001 ...`. */
function formatRow(task: ResolvedTask, index: number): string {
  // YAML preserves authored whitespace; `Fix\tUI\nnow` must occupy one fzf row.
  const title = task.task.title.replace(/[\t\r\n]/g, " ");
  const visible =
    task.state.padEnd(STATUS_COLUMN_WIDTH) +
    COLUMN_GAP +
    task.task.id.padEnd(MINIMUM_TASK_ID_LENGTH) +
    COLUMN_GAP +
    title;
  return `${String(index)}\t${visible}`;
}

/**
 * For preview paths `/repo/T0001.md` and `/repo/T0002.md`, returns:
 *
 * ```sh
 * case {1} in
 *   0) cat '/repo/T0001.md' ;;
 *   1) cat '/repo/T0002.md' ;;
 *   *) exit 1 ;;
 * esac
 * ```
 *
 * If field 1 is `0`, fzf replaces `{1}` with `0`; the shell selects the `0)`
 * arm and `cat` prints T0001. `;;` ends each arm, `*)` handles an unknown index,
 * and `esac` closes the case command.
 */
function previewCommand(tasks: readonly ResolvedTask[]): string {
  const cases = tasks.map(
    (task, index) =>
      `  ${String(index)}) cat ${quoteForShell(task.previewPath)} ;;`,
  );
  return ["case {1} in", ...cases, "  *) exit 1 ;;", "esac"].join("\n");
}

function quoteForShell(value: string): string {
  return `'${value.replaceAll("'", SHELL_SINGLE_QUOTE_ESCAPE)}'`;
}

function firstLine(output: string): string {
  const lineFeed = output.indexOf("\n");
  const line = lineFeed === -1 ? output : output.slice(0, lineFeed);
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}
