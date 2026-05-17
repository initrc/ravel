---
id: T0020
title: Show navigation hint in CommandInput when empty
status: done
dependencies: []
---

# Scope

When the CommandInput has no output (empty state), show a hint text that tells the user what they can do. The hint should use arrow symbols (↑ ↓) instead of text like "up/down".

The hint should cover:
- `/` for available commands
- `↑`/`↓` to scroll through past command output (event log)
- `PgUp`/`PgDn` to page through the event log

# Acceptance

- When the input is empty, a dimmed hint is shown after the `> ` prompt in the input area.
- The hint uses arrow symbols: `↑` and `↓`.
- Hint text is concise and dimmed, consistent with the rest of the TUI styling.
- `npm run build` succeeds.
- `npm test` passes.

# Implementation Notes

- The hint is shown in the input area after the `> ` prompt, replacing the input text when the input is empty.
- Use `dimColor` (from `app.tsx` line 16) for the hint styling, matching how status lines are dimmed.
- The event log scroll keys are handled in `EventLog.tsx` — confirm the hint matches actual behavior.
