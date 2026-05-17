import { Box, Text } from "ink";
import type { Task } from "../../task.js";

interface ColumnProps {
  title: string;
  tasks: Task[];
  accent: string;
}

export function Column({ title, tasks, accent }: ColumnProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={accent}
      paddingX={1}
      flexGrow={1}
    >
      <Text bold color={accent}>
        {title}
      </Text>
      {tasks.length === 0 && <Text dimColor>-</Text>}
      {tasks.map((t) => (
        <Text key={t.id}>{t.id}</Text>
      ))}
    </Box>
  );
}
