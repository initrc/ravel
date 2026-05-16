import * as fs from "node:fs";
import * as path from "node:path";

export interface Session {
  taskId: string;
  branch: string;
  worktreePath: string;
}

function sessionsDir(projectRoot: string): string {
  return path.join(projectRoot, ".ravel", "sessions");
}

export function sessionPath(projectRoot: string, taskId: string): string {
  return path.join(sessionsDir(projectRoot), `${taskId}.json`);
}

export function readSession(
  projectRoot: string,
  taskId: string,
): Session | null {
  const filePath = sessionPath(projectRoot, taskId);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Session;
}

export function writeSession(
  projectRoot: string,
  session: Session,
): void {
  const dir = sessionsDir(projectRoot);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    sessionPath(projectRoot, session.taskId),
    JSON.stringify(session, null, 2) + "\n",
    "utf-8",
  );
}

export function deleteSession(
  projectRoot: string,
  taskId: string,
): void {
  const filePath = sessionPath(projectRoot, taskId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
