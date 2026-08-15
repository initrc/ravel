# TypeScript and React Conventions

## Represent fixed sets of strings

- Use a direct string union for external values that need only compile-time
  checking.
- Use a string enum for internal domain states.
- Use an `as const` array when runtime code must enumerate the values.
- Use an `as const` object when runtime code needs named constants.
- Do not add a runtime representation only for hypothetical future needs.

## Keep React component files under 250 lines

Each React component file must remain under 250 lines. Extract independently
named components, hooks, or non-UI helpers into separate files before the file
exceeds that limit.

## Use standard icon providers

Use [Lucide](https://lucide.dev/) for interface icons. Use
[Simple Icons](https://simpleicons.org/) or an official asset for brand icons;
never hand-draw an approximation of a brand icon.
