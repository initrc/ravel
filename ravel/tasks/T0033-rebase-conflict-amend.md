---
id: T0033
title: Amend rebase conflict resolutions to the commit
status: new
dependencies: []
---

# Scope

Update the agent prompt so that when resolving rebase conflicts, the AI agent amends the conflict resolution changes to the commit rather than creating a separate commit.

# Acceptance

- The prompt in `generatePrompt()` instructs the agent to amend conflict resolutions into the commit (e.g., `git add ... && git commit --amend --no-edit` or `git rebase --continue`).
- The prompt clearly distinguishes between "resolve conflicts" and "commit separately" so the agent doesn't create a standalone conflict-resolution commit.
- `npm run build` succeeds.
- `npm test` passes.

# Implementation Notes

- The rebase instruction was added in T0029 in `src/prompts/prompt.ts` in `generatePrompt()`. Look for the rebase-related text near the LGTM section.
- The current text likely says something like "resolve any conflicts from the rebase" — it should be extended to specify that conflict resolutions should be amended to the existing commit.
