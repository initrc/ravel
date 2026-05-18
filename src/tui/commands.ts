export interface CommandDef {
  name: string;
  description: string;
  takesArg?: boolean;
}

export const COMMANDS: CommandDef[] = [
  { name: "/assign", description: "Assign a task", takesArg: true },
  { name: "/config", description: "Show configuration" },
  { name: "/exit", description: "Exit the dashboard" },
  { name: "/help", description: "Show available commands" },
  { name: "/integrate", description: "Integrate a completed task", takesArg: true },
  { name: "/quit", description: "Exit the dashboard" },
];
