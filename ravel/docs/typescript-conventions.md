# TypeScript and React Conventions

These are defaults, not rules to apply mechanically. Prefer the simplest code
that makes domain rules and data flow obvious.

## Avoid magic values

Do not repeat important numbers or strings throughout the code. Give them names
that explain what they mean:

```ts
export const REQUEST_TIMEOUT_MS = 30 * 1000
```

For a fixed set of API strings, define one constant object and derive the type
from it:

```ts
export const OPERATION_STATE = {
  idle: "idle",
  running: "running",
  ready: "ready",
  failed: "failed",
} as const

export type OperationState =
  (typeof OPERATION_STATE)[keyof typeof OPERATION_STATE]

export function isOperationRunning(state: OperationState): boolean {
  return state === OPERATION_STATE.running
}
```

Use `OperationState` where TypeScript expects a type. Use `OPERATION_STATE`
when assigning or comparing values. Do not repeat raw strings such as
`"running"`.

TypeScript `enum` can also represent a fixed set of values, but its members use
a separate enum type rather than the plain strings found in JSON. For JSON API
strings, prefer `as const`: the object contains the exact strings sent over the
API, and the type is derived from those same values.

## Use existing API contracts

Use fields already returned by the API instead of calculating them again in the
browser. Keep frontend response types aligned with backend response models.

If a task describes an older API, point out the mismatch and update the task
before coding. Do not expand the API or database only to preserve an
unconfirmed UX decision.

## Organize code for readers

### Write simple code

Write code that can be understood on the first read. Do not compress several
steps into a clever expression just because the language allows it. Prefer
descriptive names and ordinary `if` or `for` statements. If a line needs a
comment to explain how it works, rewrite the line more clearly.

### Put components in separate files

Page and view components compose features; they should not contain the details
of every feature they display. Do not wait for a file to become long before
choosing a component boundary.

Before adding UI to a page or view, move it to its own component file when any
of these are true:

- The UI has an independent domain name or workflow, such as a form, editor,
  table row, or toolbar.
- It owns input state plus user actions or switches between visible modes.
- It owns an asynchronous request, pending state, progress, or error display.
- It owns polling, timers, subscriptions, or another distinct effect lifecycle.

A component does not need to be reused before it deserves its own file. Do not
keep a workflow in a page or view merely because related code is already there,
or because doing so produces fewer files or a smaller initial diff. Move the
related state and handlers with the component so its parent only passes the
shared data and callbacks it needs.

For example, a page should compose a feature-specific form instead of owning
the form fields, mode switches, asynchronous request, and error display itself.

A small helper may stay in the same file only when it is easy to scan and owns
no state, effect, request, or user-facing workflow. Default to one independently
named component per file.

## Use standard icon providers

- Use [Lucide](https://lucide.dev/) through `lucide-react` for ordinary
  interface icons.
- Use [Simple Icons](https://simpleicons.org/) for brand icons.
- Use an official brand asset when the icon is unavailable from Simple Icons or
  the brand's usage rules require it.

Do not hand-draw an approximation of a recognizable icon. When copying an SVG
path into the repository, record its provider, version, and license next to the
component.

## Verify frontend changes

Run the checks required by the task. For ordinary frontend changes, run:

```sh
pnpm typecheck
pnpm lint
pnpm build
```
