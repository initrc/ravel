---
id: T0024
title: Add typeahead for slash commands in TUI
status: done
dependencies: []
---

# Scope

Add a typeahead/autocomplete feature for slash commands in the TUI's CommandInput, similar to Claude Code's command palette.

Features:
- When the user types `/`, show a dropdown of available commands.
- As the user continues typing, filter the list to matching commands.
- Tab or Enter autocompletes the highlighted command.
- Wrap the typeahead dropdown in a box to match the visual boundary of other containers.

# Acceptance

- Typing `/` reveals a dropdown list of commands: `/assign`, `/config`, `/exit`, `/help`, `/integrate`, `/quit`.
- Further typing filters commands (e.g., `/a` shows `/assign`).
- Tab autocompletes to the top (or only) match.
- Enter with a partial match autocompletes; Enter with an exact match executes the command.
- Escape closes the dropdown without executing.
- The dropdown has a border/box around it.
- Up/down arrows navigate the dropdown selection.
- `npm run build` succeeds.
- `npm test` passes.

# Implementation Notes

- Define available commands as a registry: `{ name: string, description: string }[]` in `app.tsx` or a new shared file, replacing the current chain of `if/else` checks.
- The dropdown should render above or below the `> ` prompt in `CommandInput.tsx`.
- Use Ink's `Box` with `borderStyle="round"` (or similar) for the dropdown container.
- The autocomplete state (visible, filter text, highlighted index) lives in `CommandInput.tsx` via `useState`.
- When Tab is pressed and there's exactly one match, replace the input with the full command name and hide the dropdown.
- When Enter is pressed with a partial match, autocomplete first (don't execute) — the user presses Enter again to execute.
- Consider extracting command handling into a registry so the typeahead list and the `handleCommand` function stay in sync.
