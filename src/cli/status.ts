import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { loadHaunting } from "../memory/haunting.js";
import { readJournal, parseObservations } from "../memory/journal.js";
import { readReflections } from "../memory/reflections.js";
import { readPlan } from "../memory/plan.js";
import { getHauntingStats } from "../memory/store.js";
import { estimateTokens } from "../utils/tokens.js";

export const statusCommand = new Command("status")
  .argument("<haunting>", "Haunting slug")
  .description("Show detailed status of a haunting")
  .action((slug: string) => {
    try {
      const haunting = loadHaunting(slug);
      const journal = readJournal(haunting);
      const reflections = readReflections(haunting);
      const plan = readPlan(haunting);
      const stats = getHauntingStats(haunting.id);
      const observations = parseObservations(journal);

      const statusIcon =
        haunting.config.status === "active"
          ? "🟢"
          : haunting.config.status === "paused"
            ? "🟡"
            : "⚪";

      console.log(`\n👻 ${haunting.config.name}`);
      console.log(`${"=".repeat(40)}`);
      console.log(`Status: ${statusIcon} ${haunting.config.status}`);
      console.log(`Created: ${haunting.config.created}`);
      console.log(`Schedule: ${haunting.config.schedule.interval}`);
      console.log(`Depth: ${haunting.config.research.depth}`);

      if (stats) {
        console.log(`Total cycles: ${stats.totalCycles}`);
        console.log(`Last cycle: ${stats.lastCycleAt ?? "never"}`);
      }

      console.log(`\n📊 Knowledge Base`);
      console.log(`${"─".repeat(40)}`);
      console.log(`Journal: ${estimateTokens(journal)} tokens`);
      console.log(`Observations: ${observations.length}`);

      const critical = observations.filter(
        (o) => o.priority === "critical",
      ).length;
      const notable = observations.filter(
        (o) => o.priority === "notable",
      ).length;
      const incremental = observations.filter(
        (o) => o.priority === "incremental",
      ).length;

      console.log(`  🔴 Critical: ${critical}`);
      console.log(`  🟡 Notable: ${notable}`);
      console.log(`  ⚪ Incremental: ${incremental}`);
      console.log(`Reflections: ${estimateTokens(reflections)} tokens`);

      // Source files
      const sourceFiles = fs.existsSync(haunting.sourcesDir)
        ? fs
            .readdirSync(haunting.sourcesDir)
            .filter((f) => f.endsWith(".json")).length
        : 0;
      console.log(`Pending sources: ${sourceFiles}`);

      console.log(`\n📂 Location: ${haunting.path}`);
    } catch (err) {
      console.error(`Error: ${err}`);
      process.exit(1);
    }
  });
