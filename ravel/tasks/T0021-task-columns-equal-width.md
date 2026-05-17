---
id: T0021
title: Make TaskColumns share equal width
status: new
dependencies: []
---

# Scope

The four task columns (New, In Progress, Review, Blocked) should each take exactly 1/4 of the available terminal width. Currently they use `flexGrow={1}` which gives them equal share in theory, but long task titles in one column can push others around because there's no width constraint.

# Acceptance

- All four columns have identical pixel widths regardless of content length.
- Long task titles truncate (or wrap within the column) rather than expanding the column.
- Short content doesn't cause columns to shrink below their fair share.
- The layout remains stable as tasks move between columns.
- `npm run build` succeeds.

# Implementation Notes

- The parent row in `TaskColumns.tsx` line 25 uses `flexDirection="row"` with `gap={1}`.
- Each `<Column>` in `Column.tsx` line 17 has `flexGrow={1}` but no `flexBasis`, `minWidth`, or `maxWidth`.
- Ink's flexbox implementation may need explicit `width` based on `useStdout().stdout.columns`.
- Simplest approach: compute column width as `Math.floor((termWidth - gaps) / 4)` in `TaskColumns.tsx` and pass it as a `width` prop to each `Column`.
- Alternatively, set `flexBasis={0}` on each column so they all start from the same base before growing.
