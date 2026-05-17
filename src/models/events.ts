export interface TaskCreatedEvent {
  type: "task-created";
  taskId: string;
  filename: string;
}

export interface TaskStatusChangedEvent {
  type: "task-status-changed";
  taskId: string;
  oldStatus: string;
  newStatus: string;
  filePath: string;
}

export interface DocCreatedEvent {
  type: "doc-created";
  filename: string;
}

export interface SessionRegisteredEvent {
  type: "session-registered";
  taskId: string;
  sessionPath: string;
}

export type RavelEvent =
  | TaskCreatedEvent
  | TaskStatusChangedEvent
  | DocCreatedEvent
  | SessionRegisteredEvent;
