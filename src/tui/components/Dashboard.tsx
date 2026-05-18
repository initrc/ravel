import { Box } from "ink";
import { TaskColumns } from "./TaskColumns.js";
import { EventLog } from "./EventLog.js";
import { CommandInput } from "./CommandInput.js";
import { TaskCollection, type Task } from "../../models/task.js";
import type { LogEvent } from "../app.js";

interface DashboardProps {
  tasks: Task[];
  collection: TaskCollection;
  events: LogEvent[];
  commandOutput: Array<{text: string; highlight?: boolean}>;
  onCommand: (command: string) => void | Promise<void>;
  disableInput?: boolean;
}

export function Dashboard({
  tasks,
  collection,
  events,
  commandOutput,
  onCommand,
  disableInput,
}: DashboardProps) {
  return (
    <Box flexDirection="column" height="100%" padding={1}>
      <TaskColumns tasks={tasks} collection={collection} />
      <EventLog events={events} />
      <CommandInput output={commandOutput} onCommand={onCommand} disableInput={disableInput} />
    </Box>
  );
}
