import { spawnSync } from "node:child_process";

const MAX_COMMAND_OUTPUT_BYTES = 10 * 1024 * 1024;

export interface CommandOptions {
  cwd: string;
  input?: string;
  inheritStderr?: boolean;
  inheritStdio?: boolean;
}

export interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

export interface CommandRunner {
  run(
    command: string,
    args: readonly string[],
    options: CommandOptions,
  ): CommandResult;
}

/** Runs commands directly while allowing interactive tools to retain terminal stderr. */
export class SystemCommandRunner implements CommandRunner {
  run(
    command: string,
    args: readonly string[],
    options: CommandOptions,
  ): CommandResult {
    const result = spawnSync(command, args, {
      cwd: options.cwd,
      encoding: "utf8",
      input: options.input,
      maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
      shell: false,
      stdio: options.inheritStdio
        ? "inherit"
        : options.inheritStderr
          ? ["pipe", "pipe", "inherit"]
          : ["pipe", "pipe", "pipe"],
    });

    return {
      status: result.status,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      error: result.error,
    };
  }
}
