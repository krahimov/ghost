import fs from "node:fs";
import path from "node:path";
import type { Haunting } from "../memory/haunting.js";
import { readJournal } from "../memory/journal.js";
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

export interface CycleResult {
  observationsAdded: number;
  reflected: boolean;
  planUpdated: boolean;
  notificationsSent: number;
  error?: string;
}

export async function runCycle(haunting: Haunting): Promise<CycleResult> {
  const cycleId = logCycleStart(haunting.id);
  const globalConfig = loadGlobalConfig();

  logger.info(`=== Starting research cycle for "${haunting.config.name}" ===`);

  const result: CycleResult = {
    observationsAdded: 0,
    reflected: false,
    planUpdated: false,
    notificationsSent: 0,
  };

  try {
    // 1. Load current state
    const journal = readJournal(haunting);
    const reflections = readReflections(haunting);
    const plan = readPlan(haunting);

    logger.info(
      `State loaded — journal: ${estimateTokens(journal)} tokens, reflections: ${estimateTokens(reflections)} tokens`,
    );

    // 2. Research phase
    logger.info("Phase 1/5: Research");
    await runResearch(haunting, plan, journal);

    // Count new sources
    const sourceFiles = fs
      .readdirSync(haunting.sourcesDir)
      .filter((f) => f.endsWith(".json"));
    logger.info(`Research produced ${sourceFiles.length} source files`);

    // 3. Observer phase
    logger.info("Phase 2/5: Observe");
    const updatedJournal = await runObserver(haunting, journal, reflections);
    result.observationsAdded = countNewObservations(journal, updatedJournal);
    logger.info(`Observer added ${result.observationsAdded} new observations`);

    // 4. Reflection phase
    const reflectorThreshold =
      haunting.config.reflector?.journal_token_threshold ??
      globalConfig.defaults.reflector.journal_token_threshold;

    const journalTokens = estimateTokens(updatedJournal);
    if (journalTokens > reflectorThreshold) {
      logger.info(
        `Phase 3/5: Reflect (journal at ${journalTokens} tokens, threshold: ${reflectorThreshold})`,
      );
      await runReflector(haunting, updatedJournal, reflections);
      result.reflected = true;
    } else {
      logger.info(
        `Phase 3/5: Reflect — skipped (${journalTokens}/${reflectorThreshold} tokens)`,
      );
    }

    // 5. Planning phase
    logger.info("Phase 4/5: Plan");
    const currentJournal = readJournal(haunting);
    const currentReflections = readReflections(haunting);
    const currentPlan = readPlan(haunting);
    await runPlanner(haunting, currentJournal, currentReflections, currentPlan);
    result.planUpdated = true;

    // 6. Notification phase
    logger.info("Phase 5/5: Notify");
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

    // 7. Snapshot for history
    await saveSnapshot(haunting);

    // 8. Clean up processed sources
    cleanupSources(haunting);

    // Update cycle count
    updateHauntingCycleCount(haunting.id);

    logger.info(
      `=== Cycle complete: ${result.observationsAdded} observations, reflected: ${result.reflected}, notifications: ${result.notificationsSent} ===`,
    );
  } catch (err) {
    result.error = String(err);
    logger.error(`Cycle failed: ${err}`);
  }

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
