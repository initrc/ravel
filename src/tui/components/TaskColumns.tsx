import { Box } from "ink";
import { Column } from "./Column.js";
import { TaskCollection, type Task } from "../../models/task.js";

interface TaskColumnsProps {
  tasks: Task[];
  collection: TaskCollection;
}

export function TaskColumns({ tasks, collection }: TaskColumnsProps) {
  const blockedIds = new Set(
    tasks.filter((t) => collection.isBlocked(t)).map((t) => t.id),
  );

  const newTasks = tasks.filter(
    (t) => t.status === "new" && !blockedIds.has(t.id),
  );
  const inProgressTasks = tasks.filter((t) => t.status === "in-progress");
  const reviewTasks = tasks.filter((t) => t.status === "review");
  const blockedTasks = tasks.filter(
    (t) => t.status === "new" && blockedIds.has(t.id),
  );

  return (
    <Box flexDirection="row" gap={1} paddingBottom={1}>
      <Column title="New" tasks={newTasks} accent="blue" />
      <Column title="In Progress" tasks={inProgressTasks} accent="yellow" />
      <Column title="Review" tasks={reviewTasks} accent="magenta" />
      <Column title="Blocked" tasks={blockedTasks} accent="red" />
    </Box>
  );
}
