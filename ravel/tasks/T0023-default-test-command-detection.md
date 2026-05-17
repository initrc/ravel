---
id: T0023
title: Detect npm test command during init and set as default
status: done
dependencies:
  - T0022
---

# Scope

After the agent command is set during `ravel init`, intelligently set the `testCommand` default:
- If the current repo has a `package.json` with a `"test"` script, default `testCommand` to `"npm test"` and tell the user why.
- Otherwise, leave `testCommand` empty. An empty `testCommand` skips test execution during integration.

Additionally, during `ravel init`, after the agent picker step, check these conditions and inform the user:
- "Detected npm project with test script. Set testCommand to 'npm test'."
- Or if not detected: a generic message explaining when and why `testCommand` is used (e.g., "testCommand runs your test suite before merging. Set it in .ravel/config.json.").

# Acceptance

- `ravel init` detects `package.json` with a `"test"` script and sets `testCommand: "npm test"` with an informative message.
- When no test script is detected, `testCommand` is left empty so integration skips test execution. The user is told they can configure it.
- `npm test` passes.

# Implementation Notes

- Check `fs.existsSync(path.join(cwd, "package.json"))` and parse the `"scripts"` field.
- This step runs after the agent picker (T0022), right before writing the config file.
- The config object should be built up progressively during init (agent picker → test detection → write), rather than writing `DEFAULT_CONFIG` directly.
- Update `init.test.ts` to cover both the npm-detected and non-npm paths.
