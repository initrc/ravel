---
id: T0016
title: Show action-informing text at normal brightness in TUI
status: done
dependencies: []
---

# Scope

- In the TUI command output (`src/tui/components/CommandInput.tsx`), action-informing lines like "Paste it in a new terminal to start the builder." should render at normal brightness instead of being dimmed.
- Status/info lines and the launch command itself can remain dimmed.

# Acceptance

- The "Paste it in a new terminal to start the builder." line renders without `dimColor` in the TUI.
- Other output lines (status info, the launch command) remain dimmed.
- `npm run build` succeeds.
- `npm test` passes.

# Implementation Notes

- The current code applies `dimColor` uniformly to every line in the output array (`CommandInput.tsx` line 42).
- The output array is built in `src/tui/app.tsx` lines 290-296.
- Simplest approach: in `CommandInput.tsx`, only apply `dimColor` to lines that start with the launch command prefix or status info. Or, change the output array to carry metadata about dimming. Prefer the simplest change that meets the requirement.
