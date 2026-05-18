---
id: T0038
title: Align dropdown command descriptions
status: done
dependencies: []
---

# Scope

- In the slash-command dropdown, align all command descriptions to a consistent starting column so they don't drift based on varying command name lengths.

# Acceptance

- All descriptions in the command dropdown start at the same horizontal position.
- The name column width is computed dynamically from the longest command name.
- `npx tsc --noEmit` passes.

# Implementation Notes

- `src/tui/components/CommandInput.tsx` — the dropdown rendering in `CommandInput`.
- Compute `nameWidth = Math.max(...commands.map(c => c.name.length))` and use a fixed-width `<Box width={nameWidth}>` around the name `<Text>`.
- The existing `gap={2}` on the row `Box` handles inter-column spacing.
