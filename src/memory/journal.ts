import fs from "node:fs";
import path from "node:path";
import type { Haunting } from "./haunting.js";

export function readJournal(haunting: Haunting): string {
  const journalPath = path.join(haunting.path, "journal.md");

  if (!fs.existsSync(journalPath)) {
    return "";
  }

  return fs.readFileSync(journalPath, "utf-8");
}

export function writeJournal(haunting: Haunting, content: string): void {
  const journalPath = path.join(haunting.path, "journal.md");
  fs.writeFileSync(journalPath, content, "utf-8");
}

export interface Observation {
  date: string;
  time: string;
  title: string;
  priority: "critical" | "notable" | "incremental";
  source: string;
  content: string;
}

export function parseObservations(journalContent: string): Observation[] {
  const observations: Observation[] = [];
  const obsRegex =
    /### (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) — (.+)\n\*\*Priority\*\*: (🔴 Critical|🟡 Notable|⚪ Incremental)\n\*\*Source\*\*: (.+)/g;

  let match: RegExpExecArray | null;
  while ((match = obsRegex.exec(journalContent)) !== null) {
    const priorityMap: Record<string, Observation["priority"]> = {
      "🔴 Critical": "critical",
      "🟡 Notable": "notable",
      "⚪ Incremental": "incremental",
    };

    observations.push({
      date: match[1],
      time: match[2],
      title: match[3],
      priority: priorityMap[match[4]] ?? "incremental",
      source: match[5],
      content: match[0],
    });
  }

  return observations;
}

export function extractSignificantFindings(
  journalContent: string,
  minPriority: number,
): Array<{
  priority: "critical" | "notable" | "incremental";
  title: string;
  summary: string;
  sourceUrl?: string;
}> {
  const observations = parseObservations(journalContent);
  const priorityValues: Record<string, number> = {
    critical: 1.0,
    notable: 0.7,
    incremental: 0.3,
  };

  return observations
    .filter((obs) => (priorityValues[obs.priority] ?? 0) >= minPriority)
    .map((obs) => ({
      priority: obs.priority,
      title: obs.title,
      summary: obs.content.slice(0, 200),
      sourceUrl: obs.source,
    }));
}
