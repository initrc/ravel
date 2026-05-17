import { execFile } from "node:child_process";
import type { IntegrationEvent } from "./integrate.js";

export function notify(
  event: IntegrationEvent,
  notifyWhenDone: boolean,
): void {
  if (!notifyWhenDone) return;
  if (event.type === "progress") return;

  const isSuccess = event.type === "complete";
  const sound = isSuccess ? "Glass" : "Sosumi";

  let body: string;
  switch (event.type) {
    case "complete":
      body = `${event.taskId} integration succeeded`;
      break;
    case "conflict":
      body = `${event.taskId} has merge conflicts`;
      break;
    case "test-failure":
      body = `${event.taskId} tests failed`;
      break;
    case "error":
      body = `${event.taskId} integration error: ${event.message}`;
      break;
  }

  const script = `display notification ${JSON.stringify(body)} with title ${JSON.stringify("Ravel")} sound name ${JSON.stringify(sound)}`;

  execFile("osascript", ["-e", script], (err) => {
    if (err) {
      // Best-effort: silently ignore notification failures (e.g. non-macOS).
    }
  });
}
