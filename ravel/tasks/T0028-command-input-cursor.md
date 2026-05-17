---
id: T0028
title: Add cursor to command input in TUI
status: done
dependencies: []
---

# Scope

- Add a visible text cursor indicator to the CommandInput component in the TUI.
- The cursor should appear at the end of the typed input text.

# Acceptance

- When the user types in the CommandInput, a cursor (e.g., a block or underline character) is visible at the input position.
- The cursor is visible regardless of whether the input field is focused (it should always show when input text is present).
- `npm test` passes (existing CommandInput tests should not break).

# Implementation Notes

- The component is at `src/tui/components/CommandInput.tsx`. The input text is rendered at line 85: `<Text>{input}</Text>`.
- The cursor can be a styled character appended to the input display, e.g., a block character or underscore styled distinctly.
- Ink supports state and intervals — a blinking cursor is possible with `useEffect` + `setInterval` to toggle visibility, but a static cursor is simpler and sufficient.
- Keep it minimal: a single character appended to the input text display is enough.
