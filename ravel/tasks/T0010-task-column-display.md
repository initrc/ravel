---
id: T0010
title: Improve task column display format and spacing
status: done
dependencies: []
---

# Scope

- Change each task item in TUI columns from `{t.id}` to `{t.id}: {t.title}`.
- Add visual gaps between task items within each column.

# Acceptance

- Tasks in column view show as `T0001: Project scaffolding` format.
- Adjacent task items have visible spacing between them.
- Empty columns still show dimmed `-` placeholder.

# Implementation Notes

- Edit `src/tui/components/Column.tsx`, the `tasks.map` at line 24.
- For gaps, use Ink's `Box` or `paddingBottom`/`marginBottom` on each item.
- The task `title` is already available on the `Task` object from the model.
