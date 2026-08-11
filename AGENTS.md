# AGENTS.md

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Language & Comments

Write code and comments in clear, plain English.

- Name things so the name carries the meaning. A good name removes the need for a comment. If a name needs a comment to explain what it really is, fix the name instead.
- Keep comments succinct. Explain *why*, not *what the code already says*.
- Avoid jargon and look-it-up words. If a term needs a glossary, it's the wrong term.
- Match how much comment a thing deserves. Two lines of code rarely need six lines of comment. If the comment is longer than the code and mostly apologizing for it, the code or the name is the problem.

## Ravel Conventions

Before creating or modifying any tasks or design docs, read `ravel/docs/ravel-conventions.md` and follow those conventions strictly.

### Creating Tasks

When the user says "create tasks", "add a task", "create a Ravel task", or similar:

1. Read `ravel/docs/ravel-conventions.md` to confirm the current format.
2. Find the next task ID, create the file, and write the frontmatter and body per the conventions doc.
3. Do NOT use the TaskCreate tool for Ravel tasks — write the task file directly.

## Development Commands

Run these from the project root:

| Command | What it does |
|---|---|
| `make` | Run the `build` target in `Makefile`, which delegates to `npm run build` |
| `npm run build` | Remove stale `bin/` output, compile TypeScript (`tsc`), and copy templates into `bin/` |
| `npm start` | Run `node bin/ravel.js`; until T0041, this reports that the v2 workflow is unavailable |
| `npm run lint` | Check for lint errors (`eslint .`) |
| `npm run lint:fix` | Auto-fix lint errors where possible |
| `npm test` | Run the full test suite (`vitest run`). Always run this, not a subset — a change that passes its own test file can still break another. |

`npm run <name>` executes the matching entry in `package.json`'s `scripts`
object. `make` is configured separately in `Makefile`. TypeScript compilation
settings such as source and output directories are configured in
`tsconfig.json`. The `package.json` `bin` entry maps the installed `ravel`
executable to `bin/ravel.js`; it does not control `npm start`.

When the implementation is done, always run:

```
npm run lint && npm test
```

Lint catches issues that compilation misses. Tests catch regressions beyond the files you touched.
