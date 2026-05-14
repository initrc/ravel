---
id: T0001
title: Project scaffolding and ravel init
status: new
dependencies: []
---

# Scope

- Implement `ravel init` command that creates the required folder structure.
- Create `ravel/docs/`, `ravel/tasks/`, `.ravel/sessions/`, `.ravel/logs/`.
- Generate `.ravel/config.json` with default values.
- Copy the built-in `ravel-conventions.md` to `ravel/docs/ravel-conventions.md`.
- Add `.ravel/` and `.worktrees/` entries to `.gitignore`.

# Acceptance

- `ravel init` creates all required directories.
- `ravel/docs/ravel-conventions.md` exists with task format, valid statuses, naming conventions, and blocked computation rules.
- `.ravel/config.json` exists with `builderCommand`, `copyAssignCommandByDefault`, `copyPromptByDefault`, `maxConcurrentBuilders` defaults.
- `.gitignore` contains `.ravel/` and `.worktrees/`.
- Running `ravel init` on an already-initialized project is idempotent.
- Other commands show "This does not look like a Ravel project. Run: ravel init" when not initialized.

# Implementation Notes

- Use TypeScript.
- Detect initialization by checking for `.ravel/config.json` existence.
- Idempotency: never overwrite existing config or files. Create only what's missing. Use `fs.mkdirSync` with `recursive: true` for directories; check `fs.existsSync` before writing each file.
- Appending to `.gitignore`: if `.gitignore` exists, append `.ravel/` and `.worktrees/` only if they aren't already present. Create `.gitignore` if it doesn't exist.

## Config schema (zod)

```ts
import { z } from "zod";

const ConfigSchema = z.object({
  builderCommand: z.string().default("claude"),
  copyAssignCommandByDefault: z.boolean().default(false),
  copyPromptByDefault: z.boolean().default(false),
  maxConcurrentBuilders: z.number().int().min(1).default(2),
});

type Config = z.infer<typeof ConfigSchema>;
```

## Built-in templates

Ravel ships two template files inside the package (e.g., in a `templates/` directory at the package root):

- `templates/ravel-conventions.md` — the conventions document copied to `ravel/docs/ravel-conventions.md`.
- `templates/AGENTS.md` — the full AGENTS.md content (used by T0009).

During `ravel init`, copy these templates to the project. Read them from `path.join(__dirname, "..", "templates", "<name>")` relative to the compiled CLI entry point.

## CLI entry point (Commander)

Use Commander to define the CLI structure. The entry point (`src/cli.ts` → compiled to `bin/ravel.js`) registers all top-level commands:

```ts
#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("ravel")
  .description("Local-first orchestration for interactive AI coding sessions")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a Ravel project")
  .action(() => { /* T0001 + T0009 */ });

program
  .command("assign <taskId>")
  .description("Assign a task to a new Builder session")
  .action((taskId) => { /* T0005 */ });

program
  .command("integrate <taskId>")
  .description("Run integration flow for a completed task")
  .action((taskId) => { /* T0008 */ });

// Default: launch TUI (T0007)
program.action(() => { /* T0007 */ });

program.parse();
```

Each command's action function lives in its own module and is imported — Commander is just the router. The `ravel` command (no subcommand) launches the TUI via `program.action()`.

The `bin` field in `package.json` should point to the compiled entry point: `"bin": { "ravel": "./bin/ravel.js" }`.

## tsconfig note

Set `compilerOptions.moduleResolution` to `"node16"` (or `"bundler"`) and ensure the build copies template files to the output directory (e.g., via a build script or `assets` config).
