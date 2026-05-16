---
id: T0004
title: Builder prompt generation and clipboard
status: done
dependencies:
  - T0002
---

# Scope

- Generate a Builder prompt from a task using the defined template.
- Support clipboard copy via clipboardy.
- Implement the three-option clipboard prompt: Copy, Always copy, Do not copy.
- Respect `copyPromptByDefault` config to skip the prompt.

# Acceptance

- Prompt template includes the correct task file path and commit message format.
- Clipboard copy works cross-platform.
- Three-option prompt is displayed unless `copyPromptByDefault` is set.
- "Always copy" updates the config preference.

# Implementation Notes

- Use clipboardy for cross-platform clipboard support.
- The prompt is generated as a pure function, not loaded from a file. Import the task data and interpolate.

## Prompt generation function

```ts
function generatePrompt(task: Task): string {
  return `You are working in a git worktree for task ${task.id}.

Implement the task described in:
ravel/tasks/${task.filename}

When the implementation is ready for human review:
- update the task status to review
- stop and wait for my feedback

If I later say LGTM:
- update the task status to done
- create exactly one local git commit
- use this commit message format:
  ${task.id}: ${task.title}

Do not push, merge, rebase, or delete branches.`;
}
```

## Clipboard flow

This is a three-state terminal prompt after the prompt text is displayed:

```
Prompt copied? [1. Copy / 2. Always copy / Esc. Do not copy]
```

Implementation approach:
1. Always print the generated prompt to stdout first.
2. Then present the clipboard menu using a simple readline or inquirer prompt.
3. Option 1 (`1`): `clipboardy.writeSync(prompt)` — one-time copy.
4. Option 2 (`2`): `clipboardy.writeSync(prompt)` + update `.ravel/config.json` `copyPromptByDefault` to `true`.
5. Esc: do nothing.
6. If `config.copyPromptByDefault` is `true`, skip the menu and copy directly.

## Dependencies

- `clipboardy` for clipboard access.
- `readline` (Node built-in) or `inquirer` for the menu. Prefer readline for fewer dependencies.
