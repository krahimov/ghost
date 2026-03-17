import type { Observation, Finding } from "./types.js";

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
): Finding[] {
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

export function countObservations(journalContent: string): number {
  return (journalContent.match(/^### \d{4}-\d{2}-\d{2}/gm) || []).length;
}

export function estimateTokens(text: string): number {
  return Math.round(text.length / 4);
}
