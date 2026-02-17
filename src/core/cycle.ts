import fs from "node:fs";
import path from "node:path";
import type { Haunting } from "../memory/haunting.js";
import { readJournal, parseObservations } from "../memory/journal.js";
import { readReflections } from "../memory/reflections.js";
import { readPlan } from "../memory/plan.js";
import { extractSignificantFindings } from "../memory/journal.js";
import {
  logCycleStart,
  logCycleEnd,
  updateHauntingCycleCount,
} from "../memory/store.js";
import { runResearch } from "./researcher.js";
import { runObserver } from "./observer.js";
import { runReflector } from "./reflector.js";
import { runPlanner } from "./planner.js";
import { Notifier } from "../notifications/index.js";
import { estimateTokens } from "../utils/tokens.js";
import { logger } from "../utils/logger.js";
import { loadGlobalConfig } from "../config/index.js";
import { readContext, readPurpose } from "../memory/context.js";

export interface CycleResult {
  observationsAdded: number;
  reflected: boolean;
  planUpdated: boolean;
  notificationsSent: number;
  error?: string;
  /** Final journal content after the cycle */
  journal: string;
  /** Final plan content after the cycle */
  plan: string;
  /** Final reflections content after the cycle */
  reflections: string;
}

interface CycleStatus {
  phase: string;
  phaseNumber: number;
  startedAt: string;
  sourcesFound: number;
  observationsAdded: number;
  error?: string;
}

function writeCycleStatus(haunting: Haunting, status: CycleStatus): void {
  const statusPath = path.join(haunting.path, "cycle_status.json");
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2), "utf-8");
}

function clearCycleStatus(haunting: Haunting): void {
  const statusPath = path.join(haunting.path, "cycle_status.json");
  if (fs.existsSync(statusPath)) {
    fs.unlinkSync(statusPath);
  }
}

/**
 * Polls the sources directory for new JSON files during the research phase.
 * Prints a line for each new source found.
 * Returns a cleanup function to stop polling.
 */
function startSourcePolling(haunting: Haunting): { stop: () => void; getCount: () => number } {
  const seenFiles = new Set<string>();
  let count = 0;

  // Snapshot existing files
  if (fs.existsSync(haunting.sourcesDir)) {
    for (const f of fs.readdirSync(haunting.sourcesDir)) {
      if (f.endsWith(".json")) seenFiles.add(f);
    }
  }

  const interval = setInterval(() => {
    try {
      if (!fs.existsSync(haunting.sourcesDir)) return;

      const files = fs.readdirSync(haunting.sourcesDir).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        if (seenFiles.has(file)) continue;
        seenFiles.add(file);
        count++;

        // Try to read the source file for a summary
        try {
          const content = fs.readFileSync(path.join(haunting.sourcesDir, file), "utf-8");
          const data = JSON.parse(content);
          const title = data.source_title || data.summary?.slice(0, 60) || file;
          const relevance = data.relevance != null ? ` (relevance: ${data.relevance})` : "";
          console.log(`  📄 Found: ${title}${relevance}`);
        } catch {
          console.log(`  📄 Found: ${file}`);
        }
      }
    } catch {
      // Ignore polling errors
    }
  }, 2000);

  return {
    stop: () => clearInterval(interval),
    getCount: () => count,
  };
}

/**
 * Prints new observations that were added by the observer phase.
 */
function printNewObservations(oldJournal: string, newJournal: string): void {
  const oldObs = parseObservations(oldJournal);
  const newObs = parseObservations(newJournal);
  const oldTitles = new Set(oldObs.map((o) => o.title));

  const added = newObs.filter((o) => !oldTitles.has(o.title));
  if (added.length === 0) return;

  for (const obs of added) {
    const icon =
      obs.priority === "critical" ? "🔴" : obs.priority === "notable" ? "🟡" : "⚪";
    console.log(`  ${icon} ${obs.title}`);
    console.log(`     Source: ${obs.source}`);
  }
}

/**
 * Prints the next research priorities from the plan.
 */
function printNextPriorities(plan: string): void {
  const nextMatch = plan.match(/## Next[^\n]*\n([\s\S]*?)(?=\n## |$)/);
  if (!nextMatch?.[1]?.trim()) return;

  const lines = nextMatch[1]
    .trim()
    .split("\n")
    .filter((l) => l.trim());

  for (const line of lines.slice(0, 5)) {
    console.log(`  ${line.trim()}`);
  }
  if (lines.length > 5) {
    console.log(`  ... and ${lines.length - 5} more items`);
  }
}

export async function runCycle(haunting: Haunting): Promise<CycleResult> {
  const cycleId = logCycleStart(haunting.id);
  const globalConfig = loadGlobalConfig();
  const startTime = Date.now();

  logger.info(`=== Starting research cycle for "${haunting.config.name}" ===`);

  const result: CycleResult = {
    observationsAdded: 0,
    reflected: false,
    planUpdated: false,
    notificationsSent: 0,
    journal: "",
    plan: "",
    reflections: "",
  };

  try {
    // 1. Load current state
    const journal = readJournal(haunting);
    const reflections = readReflections(haunting);
    const plan = readPlan(haunting);
    const context = readContext();
    const purpose = readPurpose(haunting);

    logger.info(
      `State loaded — journal: ${estimateTokens(journal)} tokens, reflections: ${estimateTokens(reflections)} tokens, context: ${context ? "yes" : "no"}, purpose: ${purpose ? "yes" : "no"}`,
    );

    // 2. Research phase with live source polling
    console.log(`\n⏳ Phase 1/5: Research`);
    writeCycleStatus(haunting, {
      phase: "research",
      phaseNumber: 1,
      startedAt: new Date().toISOString(),
      sourcesFound: 0,
      observationsAdded: 0,
    });

    const poller = startSourcePolling(haunting);
    await runResearch(haunting, plan, journal, context, purpose);
    poller.stop();

    const sourceCount = poller.getCount();
    console.log(`  ✓ Research complete — ${sourceCount} sources collected\n`);

    // 3. Observer phase
    console.log(`⏳ Phase 2/5: Observe`);
    writeCycleStatus(haunting, {
      phase: "observe",
      phaseNumber: 2,
      startedAt: new Date().toISOString(),
      sourcesFound: sourceCount,
      observationsAdded: 0,
    });

    const updatedJournal = await runObserver(haunting, journal, reflections, context, purpose);
    result.observationsAdded = countNewObservations(journal, updatedJournal);

    printNewObservations(journal, updatedJournal);
    console.log(`  ✓ ${result.observationsAdded} new observations added\n`);

    // 4. Reflection phase
    const reflectorThreshold =
      haunting.config.reflector?.journal_token_threshold ??
      globalConfig.defaults.reflector.journal_token_threshold;

    const journalTokens = estimateTokens(updatedJournal);
    if (journalTokens > reflectorThreshold) {
      console.log(`⏳ Phase 3/5: Reflect (journal at ${journalTokens} tokens)`);
      writeCycleStatus(haunting, {
        phase: "reflect",
        phaseNumber: 3,
        startedAt: new Date().toISOString(),
        sourcesFound: sourceCount,
        observationsAdded: result.observationsAdded,
      });

      await runReflector(haunting, updatedJournal, reflections);
      result.reflected = true;
      console.log(`  ✓ Reflections updated\n`);
    } else {
      console.log(
        `⏳ Phase 3/5: Reflect — skipped (${journalTokens}/${reflectorThreshold} tokens)\n`,
      );
    }

    // 5. Planning phase
    console.log(`⏳ Phase 4/5: Plan`);
    writeCycleStatus(haunting, {
      phase: "plan",
      phaseNumber: 4,
      startedAt: new Date().toISOString(),
      sourcesFound: sourceCount,
      observationsAdded: result.observationsAdded,
    });

    const currentJournal = readJournal(haunting);
    const currentReflections = readReflections(haunting);
    const currentPlan = readPlan(haunting);
    await runPlanner(haunting, currentJournal, currentReflections, currentPlan);
    result.planUpdated = true;

    const finalPlan = readPlan(haunting);
    console.log(`  ✓ Plan updated — next priorities:`);
    printNextPriorities(finalPlan);
    console.log();

    // 6. Notification phase
    console.log(`⏳ Phase 5/5: Notify`);
    writeCycleStatus(haunting, {
      phase: "notify",
      phaseNumber: 5,
      startedAt: new Date().toISOString(),
      sourcesFound: sourceCount,
      observationsAdded: result.observationsAdded,
    });

    const significantFindings = extractSignificantFindings(
      readJournal(haunting),
      0.8,
    );
    if (significantFindings.length > 0) {
      const notifier = new Notifier({
        console: globalConfig.notifications.channels.console.enabled,
      });
      await notifier.notify(haunting, significantFindings);
      result.notificationsSent = significantFindings.length;
    }
    console.log(`  ✓ ${result.notificationsSent} notifications sent\n`);

    // 7. Snapshot for history
    await saveSnapshot(haunting);

    // 8. Clean up processed sources
    cleanupSources(haunting);

    // Update cycle count
    updateHauntingCycleCount(haunting.id);

    // Capture final state for reporting
    result.journal = readJournal(haunting);
    result.plan = readPlan(haunting);
    result.reflections = readReflections(haunting);

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    logger.info(
      `=== Cycle complete in ${timeStr}: ${result.observationsAdded} observations, reflected: ${result.reflected}, notifications: ${result.notificationsSent} ===`,
    );
    console.log(`✅ Cycle complete in ${timeStr}`);
  } catch (err) {
    result.error = String(err);
    logger.error(`Cycle failed: ${err}`);
    console.log(`\n❌ Cycle failed: ${err}`);
  }

  // Clean up status file
  clearCycleStatus(haunting);

  logCycleEnd(cycleId, {
    observationsAdded: result.observationsAdded,
    sourcesFetched: 0,
    reflected: result.reflected,
    planItemsAdded: 0,
    notificationsSent: result.notificationsSent,
    error: result.error,
  });

  return result;
}

function countNewObservations(
  oldJournal: string,
  newJournal: string,
): number {
  const countHeaders = (text: string) =>
    (text.match(/^### \d{4}-\d{2}-\d{2}/gm) || []).length;
  return Math.max(0, countHeaders(newJournal) - countHeaders(oldJournal));
}

async function saveSnapshot(haunting: Haunting): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const historyDir = haunting.historyDir;

  const journalSrc = path.join(haunting.path, "journal.md");
  const planSrc = path.join(haunting.path, "plan.md");

  if (fs.existsSync(journalSrc)) {
    fs.copyFileSync(
      journalSrc,
      path.join(historyDir, `journal_${date}.md`),
    );
  }
  if (fs.existsSync(planSrc)) {
    fs.copyFileSync(planSrc, path.join(historyDir, `plan_${date}.md`));
  }

  logger.debug(`Snapshot saved to history/ for ${date}`);
}

function cleanupSources(haunting: Haunting): void {
  const files = fs
    .readdirSync(haunting.sourcesDir)
    .filter((f) => f.endsWith(".json"));

  for (const file of files) {
    fs.unlinkSync(path.join(haunting.sourcesDir, file));
  }

  if (files.length > 0) {
    logger.debug(`Cleaned up ${files.length} processed source files`);
  }
}
