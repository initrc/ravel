---
id: T0022
title: Rename builderCommand to agentCommand and add agent picker to init
status: new
dependencies: []
---

# Scope

Rename `builderCommand` to `agentCommand` across the entire codebase and design doc. Add an interactive agent selection step to `ravel init` that lets users pick from available AI coding agents on their `$PATH`.

## Part 1: Rename builderCommand → agentCommand

Rename every reference to `builderCommand` in:
- `src/commands/config.ts` — ConfigSchema field, DEFAULT_CONFIG, and any direct usage
- `src/commands/config.test.ts` — all test references
- `src/commands/init.test.ts` — all test references
- `src/commands/prompt.ts` — `generateLaunchCommand()` parameter
- `src/tui/app.tsx` — `/config` display and `/assign` handler
- `src/ravel.ts` — CLI `assign` command
- `ravel/docs/design-v1.md` — config example and any descriptive text
- `ravel/tasks/T0001-project-scaffolding.md` — task spec reference
- `ravel/tasks/T0005-assign-command.md` — task spec reference
- `ravel/tasks/T0015-reorder-launch-command-parts.md` — task spec reference

## Part 2: Agent picker during `ravel init`

After writing the conventions file but before writing the config file in `init.ts`:
1. Check `$PATH` for known AI agent CLIs: `claude`, `codex`, `gemini-cli`, `qwen`, `opencode`, `pi`.
2. Present only the ones found on `$PATH` as numbered options.
3. Let the user pick one by typing a number.
4. Use the picked command as `agentCommand` in the written config.
5. After setting, print: "The rest of the settings can be edited in .ravel/config.json."

# Acceptance

- `builderCommand` does not appear anywhere in the codebase (except historical task files which are documentation).
- `agentCommand` is the canonical name in schema, config, and all usage sites.
- `ravel init` interactively asks which agent to use, listing only agents found on `$PATH`.
- If no known agents are on `$PATH`, the user can type a custom command.
- `npm run build` succeeds.
- `npm test` passes.

# Implementation Notes

- Use `which` or `command -v` to check if each agent binary exists on `$PATH`.
- For the interactive picker, use `readline` similar to `waitForKeypress()` in `prompt.ts`, but accept digit keys (1-6) and map them to the available options.
- The config is written with the user's chosen agent instead of the hardcoded `"claude"` default.
- Remove `"claude"` as a hardcoded default from `DEFAULT_CONFIG` — the init flow always sets it explicitly via the picker.
- Design doc line 531: change the example field and any surrounding description of the config.
