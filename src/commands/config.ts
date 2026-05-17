import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";

export const ConfigSchema = z.object({
  agentCommand: z.string().default("claude"),
  copyCommandByDefault: z.boolean().default(false),
  mainBranch: z.string().default("main"),
  testCommand: z.string().default("npm test"),
  notifyWhenDone: z.boolean().default(true),
});

export type Config = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG: Config = {
  agentCommand: "claude",
  copyCommandByDefault: false,
  mainBranch: "main",
  testCommand: "npm test",
  notifyWhenDone: true,
};

export function readConfig(cwd: string = process.cwd()): Config {
  const cfgPath = configPath(cwd);
  if (!fs.existsSync(cfgPath)) {
    throw new Error(
      "Config file not found. Run 'ravel init' to initialize the project.",
    );
  }
  const raw: unknown = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
  return ConfigSchema.parse(raw);
}

export function writeConfig(cwd: string, config: Config): void {
  const cfgPath = configPath(cwd);
  fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2) + "\n");
}

export function configPath(cwd: string = process.cwd()): string {
  return path.join(cwd, ".ravel", "config.json");
}

export function requireInit(cwd: string = process.cwd()): void {
  const cfgPath = configPath(cwd);
  if (!fs.existsSync(cfgPath)) {
    console.error("This does not look like a Ravel project.");
    console.error("");
    console.error("Run:");
    console.error("  ravel init");
    process.exit(1);
  }
}
