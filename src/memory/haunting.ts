import fs from "node:fs";
import path from "node:path";
import type { HauntingConfig } from "../config/schema.js";
import { loadHauntingConfig, saveHauntingConfig } from "../config/index.js";
import { createDefaultHauntingConfig } from "../config/defaults.js";
import {
  getHauntingsDir,
  getHauntingDir,
  slugify,
  ensureDir,
} from "../utils/paths.js";
import { logger } from "../utils/logger.js";

export interface Haunting {
  id: string;
  path: string;
  sourcesDir: string;
  historyDir: string;
  config: HauntingConfig;
}

export function createHaunting(
  name: string,
  description: string,
  searchQueries: string[] = [],
  configOverrides?: Partial<HauntingConfig>,
): Haunting {
  const slug = slugify(name);
  const hauntingDir = getHauntingDir(slug);

  if (fs.existsSync(hauntingDir)) {
    throw new Error(`Haunting "${slug}" already exists at ${hauntingDir}`);
  }

  // Create directory structure
  ensureDir(hauntingDir);
  ensureDir(path.join(hauntingDir, "sources"));
  ensureDir(path.join(hauntingDir, "history"));

  // Create config
  const config: HauntingConfig = {
    ...createDefaultHauntingConfig(name, description, searchQueries),
    ...configOverrides,
  };
  saveHauntingConfig(hauntingDir, config);

  // Initialize empty files
  const journalContent = `# Research Journal: ${name}\n\n## Summary\nResearch has not yet begun. Awaiting first research cycle.\n\n## Observations\n\n`;
  fs.writeFileSync(path.join(hauntingDir, "journal.md"), journalContent, "utf-8");

  const reflectionsContent = `# Reflections: ${name}\n\nNo reflections yet. Reflections are generated after the journal accumulates sufficient observations.\n`;
  fs.writeFileSync(path.join(hauntingDir, "reflections.md"), reflectionsContent, "utf-8");

  const planContent = `# Research Plan: ${name}\n\n## Objective\n${description}\n\n## Status: Active\n## Last updated: ${new Date().toISOString()}\n## Cycles completed: 0\n\n## Completed\n\n## In Progress\n\n## Next (Priority Order)\n1. [ ] Initial broad survey of the topic\n   - Rationale: Establish baseline understanding before diving deeper\n\n## Backlog\n\n## Research Strategy Notes\nThis is a new haunting. The first cycle should focus on establishing a broad understanding of the landscape.\n`;
  fs.writeFileSync(path.join(hauntingDir, "plan.md"), planContent, "utf-8");

  logger.info(`Created haunting "${name}" at ${hauntingDir}`);

  return {
    id: slug,
    path: hauntingDir,
    sourcesDir: path.join(hauntingDir, "sources"),
    historyDir: path.join(hauntingDir, "history"),
    config,
  };
}

export function loadHaunting(slugOrName: string): Haunting {
  const slug = slugify(slugOrName);
  const hauntingDir = getHauntingDir(slug);

  if (!fs.existsSync(hauntingDir)) {
    throw new Error(`Haunting "${slug}" not found at ${hauntingDir}`);
  }

  const config = loadHauntingConfig(hauntingDir);

  return {
    id: slug,
    path: hauntingDir,
    sourcesDir: path.join(hauntingDir, "sources"),
    historyDir: path.join(hauntingDir, "history"),
    config,
  };
}

export function listHauntings(): Haunting[] {
  const hauntingsDir = getHauntingsDir();

  if (!fs.existsSync(hauntingsDir)) {
    return [];
  }

  const entries = fs.readdirSync(hauntingsDir, { withFileTypes: true });
  const hauntings: Haunting[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const configPath = path.join(hauntingsDir, entry.name, "config.yaml");
    if (!fs.existsSync(configPath)) continue;

    try {
      hauntings.push(loadHaunting(entry.name));
    } catch (err) {
      logger.warn(`Skipping invalid haunting "${entry.name}": ${err}`);
    }
  }

  return hauntings;
}

export function deleteHaunting(slug: string): void {
  const hauntingDir = getHauntingDir(slug);

  if (!fs.existsSync(hauntingDir)) {
    throw new Error(`Haunting "${slug}" not found`);
  }

  fs.rmSync(hauntingDir, { recursive: true, force: true });
  logger.info(`Deleted haunting "${slug}"`);
}
