---
id: T0029
title: Move rebase responsibility to AI agent
status: new
dependencies: []
---

# Scope

- Change the LGTM workflow so the AI agent performs the rebase in the worktree, rather than Ravel doing it during integration.
- Ravel's integration flow should verify the rebase is done (feature branch is based on top of main) before proceeding to tests and merge, instead of performing the rebase itself.

# Acceptance

1. `generatePrompt()` in `prompt.ts` instructs the agent to rebase onto `<mainBranch>` after committing on LGTM. The "Do not push, merge, rebase, or delete branches" line is removed.
2. `runIntegration()` in `integrate.ts` no longer performs the rebase step (step 3). Instead, it verifies that the feature branch has been rebased on top of main's HEAD.
3. The polling step (step 2) checks both conditions: worktree is clean AND feature branch is rebased on main. If either is false, keep polling (within the timeout).
4. Tests pass.

# Implementation Notes

- **`generatePrompt` change**: Needs the main branch name. Either pass it as a parameter or read config inside the function. The function is called in `ravel.ts:108` where config is already available. New text near the LGTM section: `- rebase onto <mainBranch> (resolve any conflicts)`. Remove the "Do not push, merge, rebase, or delete branches." line.

- **`runIntegration` change**: Replace step 3 (the `git rebase mainBranch` in worktreeDir, lines 79-121) with a verification check. The polling in step 2 already waits for the worktree to be clean; extend it to also verify the rebase is done.

- **Rebase verification**: Use `git merge-base <featureBranch> <mainBranch>` and compare with `git rev-parse <mainBranch>`. If equal, feature is based on main.

- **Conflict handling**: Since the agent does the rebase, Ravel no longer needs to handle rebase conflicts. If the rebase isn't done when integration runs (polling times out), emit an error explaining that the agent needs to complete the rebase.

- **Test updates in `integrate.test.ts`**:
  - Remove or update tests that assert `git rebase main` is called.
  - Update the "happy path" test to mock `git merge-base` and `git rev-parse` returning matching hashes.
  - The conflict tests that check for `git rebase --abort` can be removed since Ravel no longer does the rebase.
