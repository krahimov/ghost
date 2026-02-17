import fs from "node:fs";
import path from "node:path";
import type { Haunting } from "../memory/haunting.js";
import type { CycleResult } from "./cycle.js";
import { parseObservations } from "../memory/journal.js";

/**
 * Prints a formatted cycle report to the console.
 * Shows all observations found and the plan for next runs.
 */
export function printCycleReport(
  haunting: Haunting,
  result: CycleResult,
): void {
  const separator = "─".repeat(60);

  console.log(`\n${separator}`);
  console.log(`  👻 GHOST RESEARCH REPORT — "${haunting.config.name}"`);
  console.log(`  ${new Date().toISOString().slice(0, 16).replace("T", " ")}`);
  console.log(separator);

  // Summary stats
  console.log(`\n  📊 Cycle Summary`);
  console.log(`     Observations added: ${result.observationsAdded}`);
  console.log(`     Reflected: ${result.reflected ? "yes" : "no"}`);
  console.log(`     Plan updated: ${result.planUpdated ? "yes" : "no"}`);
  console.log(`     Notifications: ${result.notificationsSent}`);
  if (result.error) {
    console.log(`     ⚠️  Error: ${result.error}`);
  }

  // Observations
  if (result.journal) {
    const observations = parseObservations(result.journal);
    if (observations.length > 0) {
      console.log(`\n${separator}`);
      console.log(`  🔍 OBSERVATIONS (${observations.length} total)`);
      console.log(separator);

      for (const obs of observations) {
        const priorityIcon =
          obs.priority === "critical"
            ? "🔴"
            : obs.priority === "notable"
              ? "🟡"
              : "⚪";
        console.log(`\n  ${priorityIcon} ${obs.title}`);
        console.log(`     ${obs.date} ${obs.time}`);
        console.log(`     Source: ${obs.source}`);
      }
    }
  }

  // Plan for next runs
  if (result.plan) {
    const nextItems = extractPlanSection(result.plan, "Next");
    const inProgress = extractPlanSection(result.plan, "In Progress");

    if (nextItems || inProgress) {
      console.log(`\n${separator}`);
      console.log(`  📋 PLAN FOR NEXT RUNS`);
      console.log(separator);

      if (inProgress) {
        console.log(`\n  🔄 In Progress:`);
        printPlanItems(inProgress);
      }
      if (nextItems) {
        console.log(`\n  📌 Next Priority:`);
        printPlanItems(nextItems);
      }
    }
  }

  console.log(`\n${separator}`);
  console.log(`  📁 Full data: ${haunting.path}`);
  console.log(`  💬 Chat: ghost chat ${haunting.id}`);
  console.log(`  📖 Journal: ghost journal ${haunting.id}`);
  console.log(`  📋 Plan: ghost plan ${haunting.id}`);
  console.log(separator);
  console.log();
}

/**
 * Generates and saves a full markdown report for a cycle.
 */
export function generateReport(
  haunting: Haunting,
  result: CycleResult,
): string {
  const date = new Date().toISOString().slice(0, 10);
  const time = new Date().toISOString().slice(11, 16);
  const observations = result.journal
    ? parseObservations(result.journal)
    : [];

  let report = `# Ghost Research Report: ${haunting.config.name}\n`;
  report += `**Generated**: ${date} ${time}\n\n`;

  // Summary
  report += `## Cycle Summary\n`;
  report += `- **Observations added**: ${result.observationsAdded}\n`;
  report += `- **Reflected**: ${result.reflected ? "yes" : "no"}\n`;
  report += `- **Plan updated**: ${result.planUpdated ? "yes" : "no"}\n`;
  report += `- **Notifications**: ${result.notificationsSent}\n`;
  if (result.error) {
    report += `- **Error**: ${result.error}\n`;
  }
  report += `\n`;

  // Extract journal summary section
  const summaryMatch = result.journal?.match(
    /## Summary\n([\s\S]*?)(?=\n## )/,
  );
  if (summaryMatch?.[1]?.trim()) {
    report += `## Executive Summary\n${summaryMatch[1].trim()}\n\n`;
  }

  // Observations with full details
  if (observations.length > 0) {
    report += `## Key Findings\n\n`;

    const critical = observations.filter((o) => o.priority === "critical");
    const notable = observations.filter((o) => o.priority === "notable");
    const incremental = observations.filter(
      (o) => o.priority === "incremental",
    );

    if (critical.length > 0) {
      report += `### 🔴 Critical Findings\n\n`;
      for (const obs of critical) {
        report += `#### ${obs.title}\n`;
        report += `- **Date**: ${obs.date} ${obs.time}\n`;
        report += `- **Source**: ${obs.source}\n\n`;
        report += `${obs.content}\n\n`;
      }
    }

    if (notable.length > 0) {
      report += `### 🟡 Notable Findings\n\n`;
      for (const obs of notable) {
        report += `#### ${obs.title}\n`;
        report += `- **Date**: ${obs.date} ${obs.time}\n`;
        report += `- **Source**: ${obs.source}\n\n`;
        report += `${obs.content}\n\n`;
      }
    }

    if (incremental.length > 0) {
      report += `### ⚪ Incremental Findings\n\n`;
      for (const obs of incremental) {
        report += `#### ${obs.title}\n`;
        report += `- **Date**: ${obs.date} ${obs.time}\n`;
        report += `- **Source**: ${obs.source}\n\n`;
        report += `${obs.content}\n\n`;
      }
    }

    // Sources index
    report += `## Sources\n\n`;
    const sources = new Set(observations.map((o) => o.source));
    let sourceIdx = 1;
    for (const source of sources) {
      report += `${sourceIdx}. ${source}\n`;
      sourceIdx++;
    }
    report += `\n`;
  }

  // Plan section
  if (result.plan) {
    report += `## Research Plan\n\n`;
    const planBody = result.plan.replace(/^# .+\n/, "").trim();
    report += `${planBody}\n\n`;
  }

  // Save report
  const reportsDir = path.join(haunting.path, "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, `report_${date}_${time.replace(":", "")}.md`);
  fs.writeFileSync(reportPath, report, "utf-8");

  return reportPath;
}

function extractPlanSection(
  plan: string,
  section: string,
): string | null {
  const regex = new RegExp(
    `## ${section}[^\n]*\n([\s\S]*?)(?=\n## |$)`,
  );
  const match = plan.match(regex);
  return match?.[1]?.trim() || null;
}

function printPlanItems(content: string): void {
  const lines = content.split("\n").filter((l) => l.trim());
  for (const line of lines.slice(0, 8)) {
    console.log(`     ${line.trim()}`);
  }
  if (lines.length > 8) {
    console.log(`     ... and ${lines.length - 8} more items`);
  }
}
