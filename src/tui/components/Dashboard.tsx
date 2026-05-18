import { Box } from "ink";
import { TaskColumns } from "./TaskColumns.js";
import { EventLog } from "./EventLog.js";
import { CommandInput } from "./CommandInput.js";
import { AssignTaskList } from "./AssignTaskList.js";
import { TaskCollection, type Task } from "../../models/task.js";
import type { LogEvent } from "../app.js";
import type { CommandDef } from "../commands.js";

interface DashboardProps {
  tasks: Task[];
  collection: TaskCollection;
  events: LogEvent[];
  commandOutput: Array<{text: string; highlight?: boolean}>;
  onCommand: (command: string) => void | Promise<void>;
  disableInput?: boolean;
  onAssignMode?: () => void;
  assignMode?: boolean;
  assignModeTasks?: Task[];
  assignModeSelectedIndex?: number;
  commands: CommandDef[];
}

export function Dashboard({
  tasks,
  collection,
  events,
  commandOutput,
  onCommand,
  disableInput,
  onAssignMode,
  assignMode,
  assignModeTasks = [],
  assignModeSelectedIndex = 0,
  commands,
}: DashboardProps) {
  return (
    <Box flexDirection="column" height="100%" padding={1}>
      <TaskColumns tasks={tasks} collection={collection} />
      <EventLog events={events} disableInput={assignMode} />
      {assignMode && (
        <AssignTaskList
          tasks={assignModeTasks}
          collection={collection}
          selectedIndex={assignModeSelectedIndex}
        />
      )}
      <CommandInput
        output={commandOutput}
        onCommand={onCommand}
        disableInput={disableInput || assignMode}
        onAssignMode={onAssignMode}
        commands={commands}
      />
    </Box>
  );
}
