import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface HauntingData {
  _id: string;
  name: string;
  slug: string;
  description: string;
  journal: string;
  reflections: string;
  plan: string;
  context?: string;
  purpose?: string;
  research: {
    depth: string;
    maxSourcesPerCycle: number;
    searchQueriesBase: string[];
  };
  schedule: {
    mode: string;
    interval: string;
  };
  reflectorConfig?: {
    journalTokenThreshold: number;
  };
}

/**
 * Materializes Convex haunting data into a temporary directory
 * that the Claude Agent SDK agents can read/write.
 */
export function materialize(haunting: HauntingData): string {
  const tmpDir = path.join(os.tmpdir(), `ghost-${haunting._id}`);
  const sourcesDir = path.join(tmpDir, "sources");
  const historyDir = path.join(tmpDir, "history");
  const reportsDir = path.join(tmpDir, "reports");

  // Clean up any previous run
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }

  fs.mkdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(sourcesDir, { recursive: true });
  fs.mkdirSync(historyDir, { recursive: true });
  fs.mkdirSync(reportsDir, { recursive: true });

  // Write markdown files
  fs.writeFileSync(path.join(tmpDir, "journal.md"), haunting.journal, "utf-8");
  fs.writeFileSync(
    path.join(tmpDir, "reflections.md"),
    haunting.reflections,
    "utf-8",
  );
  fs.writeFileSync(path.join(tmpDir, "plan.md"), haunting.plan, "utf-8");

  if (haunting.context) {
    fs.writeFileSync(
      path.join(tmpDir, "context.md"),
      haunting.context,
      "utf-8",
    );
  }

  if (haunting.purpose) {
    fs.writeFileSync(
      path.join(tmpDir, "purpose.md"),
      haunting.purpose,
      "utf-8",
    );
  }

  // Write config.yaml for agents that might read it
  const config = `name: "${haunting.name}"
description: "${haunting.description}"
status: active
schedule:
  mode: ${haunting.schedule.mode}
  interval: ${haunting.schedule.interval}
research:
  depth: ${haunting.research.depth}
  max_sources_per_cycle: ${haunting.research.maxSourcesPerCycle}
  search_queries_base:
${haunting.research.searchQueriesBase.map((q) => `    - "${q}"`).join("\n")}
`;
  fs.writeFileSync(path.join(tmpDir, "config.yaml"), config, "utf-8");

  return tmpDir;
}

/**
 * Reads back the updated files after a cycle phase completes.
 */
export function readBack(tmpDir: string) {
  const read = (filename: string) => {
    const filepath = path.join(tmpDir, filename);
    return fs.existsSync(filepath)
      ? fs.readFileSync(filepath, "utf-8")
      : "";
  };

  return {
    journal: read("journal.md"),
    reflections: read("reflections.md"),
    plan: read("plan.md"),
  };
}

/**
 * Reads all source JSON files from the sources directory.
 */
export function readSources(tmpDir: string) {
  const sourcesDir = path.join(tmpDir, "sources");
  if (!fs.existsSync(sourcesDir)) return [];

  const files = fs.readdirSync(sourcesDir).filter((f) => f.endsWith(".json"));
  const sources: any[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(
        path.join(sourcesDir, file),
        "utf-8",
      );
      sources.push(JSON.parse(content));
    } catch {
      // Skip invalid files
    }
  }

  return sources;
}

/**
 * Counts source JSON files in the sources directory.
 */
export function countSources(tmpDir: string): number {
  const sourcesDir = path.join(tmpDir, "sources");
  if (!fs.existsSync(sourcesDir)) return 0;
  return fs.readdirSync(sourcesDir).filter((f) => f.endsWith(".json")).length;
}

/**
 * Cleans up the temporary directory.
 */
export function cleanup(tmpDir: string): void {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }
}
