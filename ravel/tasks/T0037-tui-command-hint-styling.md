---
id: T0037
title: Polish TUI command hint styling
status: done
dependencies: []
---

# Scope

- Make trigger keys (`a`, `/`, `↑↓`, `PgUp/PgDn`) stand out in the command input placeholder text by rendering them bold, while keeping descriptive labels dimmed.

# Acceptance

- Trigger keys are rendered bold and descriptive text is dimmed in the placeholder.
- `npx tsc --noEmit` passes.

# Implementation Notes

- `src/tui/components/CommandInput.tsx` — the placeholder text at the bottom of the `CommandInput` component.
- Use nested `<Text>` elements: bold for trigger keys, `dimColor` for descriptive text.
- No visual change when the user has typed input (the placeholder only shows when input is empty).
