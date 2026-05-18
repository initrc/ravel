---
id: T0032
title: Add copy confirmation message for prompt --copy
status: done
dependencies: []
---

# Scope

When `ravel prompt <taskId> --copy` is run, print a confirmation message below the prompt text indicating it was copied and is ready to be pasted in the AI agent. Also audit similar copy confirmation messages across the CLI and TUI and make them consistent in tone and wording.

Before printing the prompt, add a separator line, then "Prompt for AI agent:" as a title, then another separator line. Make the prompt text dimmed.

# Acceptance

- `ravel prompt <taskId> --copy` prints a separator, a title, another separator, then the prompt text (dimmed), then a message like "Prompt copied to clipboard — paste it in your AI agent to start."
- Copy confirmation messages across CLI and TUI (prompt copying, command copying, assign output) use consistent language: "Prompt copied!" for prompts, "Command copied!" for commands.
- `npm run build` succeeds.
- `npm test` passes.

# Implementation Notes

- The copy logic is in `promptForClipboard()` in `src/commands/prompt.ts`. When `copy=true`, it currently copies silently and returns — this is where the message should be added.
- The message must appear below the prompt text, so it should be printed after `console.log(prompt)` in `src/ravel.ts` (or inside `promptForClipboard` after copying).
- Related copy messages to align with:
  - `promptForClipboard` interactive mode: "Copied!" (prompt.ts line 98-103)
  - `commandForClipboard`: "Copied!" / "Copied! Copy-on-default set." (prompt.ts lines 127-133)
  - TUI assign: "Launch command copied to clipboard:" + "Paste it in a new terminal to start the builder." (app.tsx lines 321-326)
