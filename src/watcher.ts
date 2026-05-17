import { EventEmitter } from "node:events";
import * as path from "node:path";
import * as fs from "node:fs";
import chokidar, { type FSWatcher } from "chokidar";
import { parseTask } from "./models/task.js";
import { readSession } from "./models/session.js";
import type { RavelEvent } from "./models/events.js";

function readDirFiles(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(ext))
    .map((e) => path.join(dir, e.name));
}

export class RavelWatcher extends EventEmitter {
  private projectRoot: string;
  private mainWatcher: FSWatcher | null = null;
  private worktreeWatchers: Map<string, FSWatcher> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private statusCache: Map<string, string> = new Map();
  private seenDocs: Set<string> = new Set();
  private knownSessions: Set<string> = new Set();

  constructor(projectRoot: string) {
    super();
    this.projectRoot = projectRoot;
  }

  async start(): Promise<void> {
    const sessionsDir = path.join(this.projectRoot, ".ravel", "sessions");
    const tasksDir = path.join(this.projectRoot, "ravel", "tasks");
    const docsDir = path.join(this.projectRoot, "ravel", "docs");

    // Pre-populate status cache for existing main task files
    for (const filePath of readDirFiles(tasksDir, ".md")) {
      try {
        const task = parseTask(filePath);
        this.statusCache.set(filePath, task.status);
      } catch {
        // skip unparseable files
      }
    }

    // Pre-populate seen docs from existing doc files
    for (const filePath of readDirFiles(docsDir, ".md")) {
      this.seenDocs.add(filePath);
    }

    // Pre-populate known sessions from existing session files
    for (const filePath of readDirFiles(sessionsDir, ".json")) {
      const taskId = path.basename(filePath).replace(/\.json$/, "");
      this.knownSessions.add(taskId);
    }

    // Start watching existing session worktrees
    if (fs.existsSync(sessionsDir)) {
      for (const entry of fs.readdirSync(sessionsDir, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith(".json")) {
          const taskId = entry.name.replace(/\.json$/, "");
          await this.startWatchingWorktree(taskId);
        }
      }
    }

    // chokidar v5 watches directories, not glob patterns
    const watchDirs = [tasksDir, docsDir, sessionsDir].filter((d) =>
      fs.existsSync(d),
    );

    this.mainWatcher = chokidar.watch(watchDirs, {
      ignoreInitial: true,
    });

    await new Promise<void>((resolve) => {
      this.mainWatcher!.on("ready", resolve);
    });

    // On macOS, new files may emit "change" instead of "add", so listen for
    // both and use caches to decide whether to emit create vs change events.
    this.mainWatcher.on("add", (filePath: string) => {
      if (filePath.startsWith(tasksDir) && filePath.endsWith(".md")) {
        this.onTaskFileEvent(filePath);
      } else if (filePath.startsWith(docsDir) && filePath.endsWith(".md")) {
        this.onDocFileEvent(filePath);
      } else if (filePath.startsWith(sessionsDir) && filePath.endsWith(".json")) {
        this.onSessionFileEvent(filePath);
      }
    });

    this.mainWatcher.on("change", (filePath: string) => {
      if (filePath.startsWith(tasksDir) && filePath.endsWith(".md")) {
        this.onTaskFileEvent(filePath);
      } else if (filePath.startsWith(docsDir) && filePath.endsWith(".md")) {
        this.onDocFileEvent(filePath);
      } else if (filePath.startsWith(sessionsDir) && filePath.endsWith(".json")) {
        this.onSessionFileEvent(filePath);
      }
    });

    this.mainWatcher.on("unlink", (filePath: string) => {
      if (filePath.startsWith(sessionsDir) && filePath.endsWith(".json")) {
        const taskId = path.basename(filePath).replace(/\.json$/, "");
        this.knownSessions.delete(taskId);
        this.stopWatchingWorktree(taskId);
      }
    });
  }

  async stop(): Promise<void> {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    if (this.mainWatcher) {
      await this.mainWatcher.close();
      this.mainWatcher = null;
    }

    for (const watcher of this.worktreeWatchers.values()) {
      await watcher.close();
    }
    this.worktreeWatchers.clear();
  }

  private onTaskFileEvent(filePath: string): void {
    const key = filePath;
    this.clearDebounce(key);
    this.debounceTimers.set(
      key,
      setTimeout(() => {
        this.debounceTimers.delete(key);
        try {
          const task = parseTask(filePath);
          const oldStatus = this.statusCache.get(filePath);
          if (oldStatus === undefined) {
            this.statusCache.set(filePath, task.status);
            this.emit("event", {
              type: "task-created",
              taskId: task.id,
              filename: task.filename,
            } satisfies RavelEvent);
          } else if (oldStatus !== task.status) {
            this.statusCache.set(filePath, task.status);
            this.emit("event", {
              type: "task-status-changed",
              taskId: task.id,
              oldStatus,
              newStatus: task.status,
              filePath,
            } satisfies RavelEvent);
          }
        } catch {
          // parse errors are ignored — file may be mid-write
        }
      }, 100),
    );
  }

  private onDocFileEvent(filePath: string): void {
    const key = filePath;
    this.clearDebounce(key);
    this.debounceTimers.set(
      key,
      setTimeout(() => {
        this.debounceTimers.delete(key);
        if (this.seenDocs.has(filePath)) return;
        this.seenDocs.add(filePath);
        this.emit("event", {
          type: "doc-created",
          filename: path.basename(filePath),
        } satisfies RavelEvent);
      }, 100),
    );
  }

  private onSessionFileEvent(filePath: string): void {
    const filename = path.basename(filePath);
    const taskId = filename.replace(/\.json$/, "");

    const key = filePath;
    this.clearDebounce(key);
    this.debounceTimers.set(
      key,
      setTimeout(() => {
        this.debounceTimers.delete(key);
        if (this.knownSessions.has(taskId)) return;
        this.knownSessions.add(taskId);
        void this.startWatchingWorktree(taskId);
        this.emit("event", {
          type: "session-registered",
          taskId,
          sessionPath: filePath,
        } satisfies RavelEvent);
      }, 100),
    );
  }

  private async startWatchingWorktree(taskId: string): Promise<void> {
    if (this.worktreeWatchers.has(taskId)) return;

    const session = readSession(this.projectRoot, taskId);
    if (!session) return;

    const tasksDir = path.join(
      this.projectRoot,
      session.worktreePath,
      "ravel",
      "tasks",
    );
    if (!fs.existsSync(tasksDir)) return;

    // Pre-populate status cache for existing task files in the worktree
    for (const filePath of readDirFiles(tasksDir, ".md")) {
      try {
        const task = parseTask(filePath);
        if (!this.statusCache.has(filePath)) {
          this.statusCache.set(filePath, task.status);
        }
      } catch {
        // skip unparseable files
      }
    }

    const watcher = chokidar.watch(tasksDir, {
      ignoreInitial: true,
    });

    watcher.on("add", (filePath: string) => {
      if (filePath.endsWith(".md")) {
        this.onTaskFileEvent(filePath);
      }
    });
    watcher.on("change", (filePath: string) => {
      if (filePath.endsWith(".md")) {
        this.onTaskFileEvent(filePath);
      }
    });

    await new Promise<void>((resolve) => {
      watcher.on("ready", resolve);
    });

    this.worktreeWatchers.set(taskId, watcher);
  }

  private stopWatchingWorktree(taskId: string): void {
    const watcher = this.worktreeWatchers.get(taskId);
    if (watcher) {
      void watcher.close();
      this.worktreeWatchers.delete(taskId);
    }
  }

  private clearDebounce(key: string): void {
    const existing = this.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
      this.debounceTimers.delete(key);
    }
  }
}
