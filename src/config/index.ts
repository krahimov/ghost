import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { GlobalConfigSchema, HauntingConfigSchema } from "./schema.js";
import type { GlobalConfig, HauntingConfig } from "./schema.js";
import { DEFAULT_GLOBAL_CONFIG } from "./defaults.js";
import { getGhostHome } from "../utils/paths.js";

export { GlobalConfigSchema, HauntingConfigSchema } from "./schema.js";
export type { GlobalConfig, HauntingConfig } from "./schema.js";
export { DEFAULT_GLOBAL_CONFIG, createDefaultHauntingConfig } from "./defaults.js";

export function loadGlobalConfig(): GlobalConfig {
  const ghostHome = getGhostHome();
  const configPath = path.join(ghostHome, "config.yaml");

  if (!fs.existsSync(configPath)) {
    return DEFAULT_GLOBAL_CONFIG;
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = YAML.parse(raw);
  return GlobalConfigSchema.parse(parsed);
}

export function saveGlobalConfig(config: GlobalConfig): void {
  const ghostHome = getGhostHome();
  fs.mkdirSync(ghostHome, { recursive: true });
  const configPath = path.join(ghostHome, "config.yaml");
  fs.writeFileSync(configPath, YAML.stringify(config), "utf-8");
}

export function loadHauntingConfig(hauntingDir: string): HauntingConfig {
  const configPath = path.join(hauntingDir, "config.yaml");

  if (!fs.existsSync(configPath)) {
    throw new Error(`Haunting config not found: ${configPath}`);
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = YAML.parse(raw);
  return HauntingConfigSchema.parse(parsed);
}

export function saveHauntingConfig(
  hauntingDir: string,
  config: HauntingConfig,
): void {
  const configPath = path.join(hauntingDir, "config.yaml");
  fs.writeFileSync(configPath, YAML.stringify(config), "utf-8");
}
