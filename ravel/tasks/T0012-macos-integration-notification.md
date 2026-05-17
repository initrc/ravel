---
id: T0012
title: Send macOS notification on integration result
status: new
dependencies: []
---

# Scope

- Add `notifyWhenDone` config field (boolean, default `true`) to `ConfigSchema`.
- Send a native macOS notification with sound when integration succeeds or fails.
- Gate notifications behind the `notifyWhenDone` config flag.
- Run `osascript` to display a notification via AppleScript/JXA.
- Fire on `complete`, `conflict`, `test-failure`, and `error` integration events.

# Acceptance

- `notifyWhenDone` defaults to `true` in config and appears in TUI `/config` output.
- When `notifyWhenDone` is `false`, no notification is sent.
- Successful integration triggers a macOS notification with success sound.
- Failed integration (conflict, test failure, error) triggers a macOS notification with a distinct failure sound.
- Notification includes the task ID and result summary.
- No notification spam on `progress` events.
- Works when running in both CLI mode (`ravel integrate`) and TUI mode (auto-integration on task done).

# Implementation Notes

- The project already has a transitive dependency on `run-jxa` (wraps `osascript -l JavaScript`) which can send macOS notifications. Consider using it directly, or shell out to `osascript` via `execFile`.
- Integration event types are defined in `src/commands/integrate.ts:11-16` as an `IntegrationEvent` discriminated union.
- Notification hook points in CLI mode: `src/ravel.ts:122-141` (the `integrate` command's event switch).
- Notification hook points in TUI mode: `src/tui/app.tsx:159-184` (the `integrateTask` function).
- To avoid duplication, extract a shared `notify(ev: IntegrationEvent)` helper.
- macOS notification via `osascript`:
  ```
  osascript -e 'display notification "T0003 integration failed" with title "Ravel" sound name "Basso"'
  ```
- Sound names: `"Basso"`, `"Glass"`, `"Hero"`, `"Pop"`, `"Purr"` (success); `"Sosumi"`, `"Funk"` (failure). Default system sound is `"default"`.
- Only fire on non-progress events (`complete`, `conflict`, `test-failure`, `error`).
- Read `notifyWhenDone` from config before firing notification; skip if `false`.
- Config schema change in `src/commands/config.ts`: add `notifyWhenDone: z.boolean().default(true)`.
