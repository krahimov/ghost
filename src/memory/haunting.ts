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

/**
 * Extract concrete research priorities from a user's description.
 * Splits on natural language connectors (and, also, additionally, commas)
 * and turns each clause into a research item.
 */
function extractPrioritiesFromDescription(description: string): string[] {
  // Split on "I also want", "I want to", "also", commas with conjunctions
  const clauses = description
    .replace(/I (also )?want to (learn |know |understand |make sure |find out )?/gi, "|")
    .replace(/\balso\b/gi, "|")
    .replace(/\badditionally\b/gi, "|")
    .split("|")
    .map((c: string) => c.trim().replace(/^[,.\s]+|[,.\s]+$/g, ""))
    .filter((c: string) => c.length > 10);

  if (clauses.length === 0) {
    return [`Research: ${description.slice(0, 100)}`];
  }

  return clauses.map((clause: string) => {
    // Capitalize first letter
    const item = clause.charAt(0).toUpperCase() + clause.slice(1);
    return `Research ${item}`;
  });
}

export function hauntingExists(name: string): boolean {
  const slug = slugify(name);
  return fs.existsSync(getHauntingDir(slug));
}

export function createHaunting(
  name: string,
  description: string,
  searchQueries: string[] = [],
  configOverrides?: Partial<HauntingConfig>,
  force = false,
): Haunting {
  const slug = slugify(name);
  const hauntingDir = getHauntingDir(slug);

  if (fs.existsSync(hauntingDir)) {
    if (force) {
      fs.rmSync(hauntingDir, { recursive: true, force: true });
    } else {
      throw new Error(`Haunting "${slug}" already exists at ${hauntingDir}`);
    }
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

  // Build initial plan with the user's description as concrete priorities
  const descPriorities = extractPrioritiesFromDescription(description);
  const priorityItems = descPriorities
    .map((p, i) => `${i + 1}. [ ] ${p}`)
    .join("\n");

  const planContent = `# Research Plan: ${name}

## Objective
${description}

## Status: Active
## Last updated: ${new Date().toISOString()}
## Cycles completed: 0

## Completed

## In Progress

## Next (Priority Order)
${priorityItems || "1. [ ] Initial broad survey of the topic\n   - Rationale: Establish baseline understanding before diving deeper"}

## Backlog

## Research Strategy Notes
This is a new haunting. The first cycle should focus on the specific interests described in the objective.
`;
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
  // Try the raw name as a directory first (handles pre-existing long slugs)
  const rawDir = getHauntingDir(slugOrName);
  if (fs.existsSync(rawDir)) {
    const config = loadHauntingConfig(rawDir);
    return {
      id: slugOrName,
      path: rawDir,
      sourcesDir: path.join(rawDir, "sources"),
      historyDir: path.join(rawDir, "history"),
      config,
    };
  }

  // Fall back to slugifying (for when users pass topic names)
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
