import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { loadHaunting } from "../memory/haunting.js";
import { readJournal, parseObservations } from "../memory/journal.js";
import { readPlan } from "../memory/plan.js";
import { readReflections } from "../memory/reflections.js";

export const reportCommand = new Command("report")
  .argument("<haunting>", "Haunting slug")
  .option("--latest", "Show the latest saved report")
  .option("--list", "List all saved reports")
  .description("View research reports with observations and sources")
  .action((slug: string, opts) => {
    try {
      const haunting = loadHaunting(slug);
      const reportsDir = path.join(haunting.path, "reports");

      if (opts.list) {
        if (!fs.existsSync(reportsDir)) {
          console.log("No reports yet. Run a research cycle first.");
          return;
        }
        const files = fs
          .readdirSync(reportsDir)
          .filter((f) => f.endsWith(".md"))
          .sort()
          .reverse();

        if (files.length === 0) {
          console.log("No reports yet. Run a research cycle first.");
          return;
        }

        console.log(`\n📄 Reports for "${haunting.config.name}":\n`);
        for (const file of files) {
          console.log(`   ${file}`);
        }
        console.log(`\n   Location: ${reportsDir}`);
        return;
      }

      if (opts.latest) {
        if (!fs.existsSync(reportsDir)) {
          console.log("No reports yet. Run a research cycle first.");
          return;
        }
        const files = fs
          .readdirSync(reportsDir)
          .filter((f) => f.endsWith(".md"))
          .sort()
          .reverse();

        if (files.length === 0) {
          console.log("No reports yet. Run a research cycle first.");
          return;
        }

        const latest = fs.readFileSync(
          path.join(reportsDir, files[0]),
          "utf-8",
        );
        console.log(latest);
        return;
      }

      // Default: print a live report from current state
      const journal = readJournal(haunting);
      const plan = readPlan(haunting);
      const reflections = readReflections(haunting);
      const observations = parseObservations(journal);

      const separator = "─".repeat(60);

      console.log(`\n${separator}`);
      console.log(`  👻 GHOST RESEARCH REPORT — "${haunting.config.name}"`);
      console.log(`  Status: ${haunting.config.status}`);
      console.log(`  Schedule: ${haunting.config.schedule.interval}`);
      console.log(separator);

      // Summary
      const summaryMatch = journal.match(
        /## Summary\n([\s\S]*?)(?=\n## )/,
      );
      if (summaryMatch?.[1]?.trim()) {
        console.log(`\n  📝 Executive Summary`);
        console.log(
          summaryMatch[1]
            .trim()
            .split("\n")
            .map((l) => `     ${l}`)
            .join("\n"),
        );
      }

      // Observations by priority
      if (observations.length > 0) {
        const critical = observations.filter(
          (o) => o.priority === "critical",
        );
        const notable = observations.filter(
          (o) => o.priority === "notable",
        );
        const incremental = observations.filter(
          (o) => o.priority === "incremental",
        );

        console.log(`\n${separator}`);
        console.log(
          `  🔍 FINDINGS (${observations.length} total: ${critical.length} critical, ${notable.length} notable, ${incremental.length} incremental)`,
        );
        console.log(separator);

        for (const obs of observations) {
          const icon =
            obs.priority === "critical"
              ? "🔴"
              : obs.priority === "notable"
                ? "🟡"
                : "⚪";
          console.log(`\n  ${icon} ${obs.title}`);
          console.log(`     ${obs.date} ${obs.time}`);
          console.log(`     Source: ${obs.source}`);
        }

        // Sources index
        const sources = [...new Set(observations.map((o) => o.source))];
        console.log(`\n${separator}`);
        console.log(`  📚 SOURCES (${sources.length})`);
        console.log(separator);
        for (let i = 0; i < sources.length; i++) {
          console.log(`  [${i + 1}] ${sources[i]}`);
        }
      } else {
        console.log(`\n  No observations yet. Run a research cycle first.`);
      }

      // Plan preview
      if (plan) {
        const nextMatch = plan.match(
          /## Next[^\n]*\n([\s\S]*?)(?=\n## |$)/,
        );
        if (nextMatch?.[1]?.trim()) {
          console.log(`\n${separator}`);
          console.log(`  📋 NEXT RESEARCH PRIORITIES`);
          console.log(separator);
          const lines = nextMatch[1]
            .trim()
            .split("\n")
            .filter((l) => l.trim());
          for (const line of lines.slice(0, 5)) {
            console.log(`     ${line.trim()}`);
          }
        }
      }

      console.log(`\n${separator}`);
      console.log(`  📁 Full data: ${haunting.path}`);
      console.log(`  💬 Chat: ghost chat ${haunting.id}`);
      console.log(separator);
      console.log();
    } catch (err) {
      console.error(`Error: ${err}`);
      process.exit(1);
    }
  });
