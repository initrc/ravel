import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";

export const ConfigSchema = z.object({
  builderCommand: z.string().default("claude"),
  copyAssignCommandByDefault: z.boolean().default(false),
  copyPromptByDefault: z.boolean().default(false),
  maxConcurrentBuilders: z.number().int().min(1).default(2),
});

export type Config = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG: Config = {
  builderCommand: "claude",
  copyAssignCommandByDefault: false,
  copyPromptByDefault: false,
  maxConcurrentBuilders: 2,
};

export function requireInit(cwd: string = process.cwd()): void {
  const configPath = path.join(cwd, ".ravel", "config.json");
  if (!fs.existsSync(configPath)) {
    console.error("This does not look like a Ravel project.");
    console.error("");
    console.error("Run:");
    console.error("  ravel init");
    process.exit(1);
  }
}
