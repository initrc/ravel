import { Box, Text } from "ink";
import { TaskCollection, type Task } from "../../models/task.js";

interface AssignTaskListProps {
  tasks: Task[];
  collection: TaskCollection;
  selectedIndex: number;
}

export function AssignTaskList({
  tasks,
  collection,
  selectedIndex,
}: AssignTaskListProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="cyan"
      paddingX={1}
      marginBottom={1}
    >
      <Text bold color="cyan">
        Assign Task
      </Text>
      {tasks.length === 0 ? (
        <Text dimColor>No tasks available to assign</Text>
      ) : (
        tasks.map((task, i) => {
          const unblocked = collection
            .getDependents(task.id)
            .filter((t) => t.status === "new")
            .map((t) => t.id);
          const unblocksText =
            unblocked.length > 0
              ? ` — unblocks ${unblocked.join(", ")} once done`
              : "";
          const line = `Assign ${task.id}: ${task.title}${unblocksText}`;

          return (
            <Text key={task.id} color={i === selectedIndex ? "cyan" : undefined}>
              {i === selectedIndex ? "> " : "  "}
              {line}
            </Text>
          );
        })
      )}
      <Text dimColor>↑↓ navigate  ↵ assign  Esc cancel</Text>
    </Box>
  );
}
