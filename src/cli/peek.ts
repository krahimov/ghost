import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { loadHaunting } from "../memory/haunting.js";
import { readJournal, parseObservations } from "../memory/journal.js";
import { readPlan } from "../memory/plan.js";

export const peekCommand = new Command("peek")
  .argument("<haunting>", "Haunting slug to peek at")
  .description("Check on a running or recent research cycle")
  .action((slug: string) => {
    try {
      const haunting = loadHaunting(slug);
      const separator = "─".repeat(50);

      console.log(`\n${separator}`);
      console.log(`  👻 Ghost Peek — "${haunting.config.name}"`);
      console.log(separator);

      // Check for active cycle status
      const statusPath = path.join(haunting.path, "cycle_status.json");
      if (fs.existsSync(statusPath)) {
        try {
          const status = JSON.parse(fs.readFileSync(statusPath, "utf-8"));
          const elapsed = Math.round(
            (Date.now() - new Date(status.startedAt).getTime()) / 1000,
          );
          const minutes = Math.floor(elapsed / 60);
          const seconds = elapsed % 60;
          const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

          console.log(`\n  🔄 CYCLE IN PROGRESS`);
          console.log(`     Phase: ${status.phaseNumber}/5 — ${status.phase}`);
          console.log(`     Running for: ${timeStr}`);

          if (status.sourcesFound > 0) {
            console.log(`     Sources found so far: ${status.sourcesFound}`);
          }
          if (status.observationsAdded > 0) {
            console.log(`     Observations added: ${status.observationsAdded}`);
          }
        } catch {
          console.log(`\n  🔄 Cycle appears to be running (status file exists)`);
        }
      } else {
        console.log(`\n  ⏸  No cycle currently running`);
      }

      // Show sources in progress (research phase)
      if (fs.existsSync(haunting.sourcesDir)) {
        const sourceFiles = fs
          .readdirSync(haunting.sourcesDir)
          .filter((f) => f.endsWith(".json"));

        if (sourceFiles.length > 0) {
          console.log(`\n  📄 SOURCES IN QUEUE (${sourceFiles.length})`);
          for (const file of sourceFiles.slice(0, 10)) {
            try {
              const content = fs.readFileSync(
                path.join(haunting.sourcesDir, file),
                "utf-8",
              );
              const data = JSON.parse(content);
              const title = data.source_title || data.summary?.slice(0, 50) || file;
              const relevance = data.relevance != null ? ` (${data.relevance})` : "";
              console.log(`     - ${title}${relevance}`);
            } catch {
              console.log(`     - ${file}`);
            }
          }
          if (sourceFiles.length > 10) {
            console.log(`     ... and ${sourceFiles.length - 10} more`);
          }
        }
      }

      // Show latest observations
      const journal = readJournal(haunting);
      const observations = parseObservations(journal);

      if (observations.length > 0) {
        const recent = observations.slice(0, 5);
        console.log(`\n  🔍 LATEST OBSERVATIONS (${observations.length} total)`);

        for (const obs of recent) {
          const icon =
            obs.priority === "critical"
              ? "🔴"
              : obs.priority === "notable"
                ? "🟡"
                : "⚪";
          console.log(`     ${icon} ${obs.title}`);
          console.log(`        ${obs.date} — ${obs.source}`);
        }
        if (observations.length > 5) {
          console.log(`     ... and ${observations.length - 5} more`);
        }
      }

      // Show next plan items
      const plan = readPlan(haunting);
      const nextMatch = plan.match(/## Next[^\n]*\n([\s\S]*?)(?=\n## |$)/);
      if (nextMatch?.[1]?.trim()) {
        console.log(`\n  📋 NEXT RESEARCH PRIORITIES`);
        const lines = nextMatch[1]
          .trim()
          .split("\n")
          .filter((l) => l.trim());
        for (const line of lines.slice(0, 3)) {
          console.log(`     ${line.trim()}`);
        }
      }

      console.log(`\n${separator}\n`);
    } catch (err) {
      console.error(`Error: ${err}`);
      process.exit(1);
    }
  });
