---
id: T0025
title: Prompt before copying launch command in TUI assign
status: new
dependencies: []
---

# Scope

In the TUI's `/assign` command, replace the auto-copy-to-clipboard behavior with a user-facing prompt, matching how the CLI `ravel assign` command works. The clipboard is sensitive — overwriting it without asking is poor UX.

## Current behavior (TUI)

- Auto-copies the launch command to clipboard without asking (app.tsx lines 287-289).
- Comment: "Auto-copy since TUI owns the terminal (no interactive prompt)".

## Desired behavior (TUI)

- After assignment, show the launch command in the output area.
- Show a prompt: "Copy command? [1. Copy / 2. Always copy / Esc. Do not copy]" — identical to `commandForClipboard()` in `prompt.ts`.
- "Always copy" persists `copyCommandByDefault: true` to config (like the CLI does).
- If `copyCommandByDefault` is already true, copy without prompting (like the CLI does).
- The prompt appears in the command output area, not as a terminal raw-mode keypress (since TUI owns the terminal).

## Additional consistency improvements

- The TUI `/assign` output lines should mirror the CLI output (`ravel.ts` lines 68-73):
  - "Run this command in a new terminal or tab."
  - "When your coding agent launches, a prepared prompt will be in your clipboard."
  - "Paste it there."
- The "Copy command?" prompt options should match `commandForClipboard` exactly.

# Acceptance

- TUI `/assign` does not auto-copy to clipboard without prompting (unless `copyCommandByDefault` is true).
- The copy prompt is visible in the command output area.
- Pressing `1` copies to clipboard.
- Pressing `2` copies to clipboard and sets `copyCommandByDefault: true` in config.
- Pressing `Escape` dismisses without copying.
- User-facing messages are consistent between TUI and CLI assign flows.
- `npm run build` succeeds.
- `npm test` passes.

# Implementation Notes

- The TUI uses `useInput` in `CommandInput.tsx`, which captures all keypresses. The copy prompt needs to be handled as a stateful interaction: after `/assign` runs, the app enters a "prompt mode" where keypresses (`1`, `2`, `Escape`) are interpreted as clipboard choices instead of command input.
- Add a `promptMode` state in `app.tsx` that, when active, intercepts keypresses in `handleCommand` or `CommandInput`.
- Alternatively, implement the copy prompt as an Ink component that renders inline and handles its own `useInput` — but multiple `useInput` hooks can conflict. Test carefully.
- The simplest approach: store a pending clipboard action in state, and in `handleCommand`, check for `1`/`2`/`Escape` keypresses when a pending action exists.
- Reuse `commandForClipboard()` from `prompt.ts` for CLI consistency, or extract the shared prompt text.
