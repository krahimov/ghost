import { Command } from "commander";
import inquirer from "inquirer";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { createHaunting } from "../memory/haunting.js";
import { registerHaunting } from "../memory/store.js";
import { getGhostHome, ensureDir } from "../utils/paths.js";
import { runCycle } from "../core/cycle.js";
import { loadHaunting } from "../memory/haunting.js";
import { logger } from "../utils/logger.js";
import fs from "node:fs";

export const hauntCommand = new Command("haunt")
  .argument("<topic>", "Topic to research")
  .option("--schedule <interval>", "Schedule interval (hourly, daily, weekly)", "daily")
  .option("--depth <depth>", "Research depth (shallow, standard, deep)", "standard")
  .option("--run", "Run the first research cycle immediately")
  .description("Create a new haunting (persistent research mission)")
  .action(async (topic: string, opts) => {
    // Ensure Ghost is initialized
    const ghostHome = getGhostHome();
    if (!fs.existsSync(`${ghostHome}/config.yaml`)) {
      ensureDir(ghostHome);
      ensureDir(`${ghostHome}/hauntings`);
      const { saveGlobalConfig, DEFAULT_GLOBAL_CONFIG } = await import("../config/index.js");
      saveGlobalConfig(DEFAULT_GLOBAL_CONFIG);
      const { getDatabase } = await import("../memory/store.js");
      getDatabase();
    }

    console.log(`\n👻 Setting up haunting: "${topic}"\n`);

    // Interactive setup
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "description",
        message: "Describe what you want to learn about this topic:",
        default: `Track and analyze developments related to ${topic}`,
      },
      {
        type: "input",
        name: "queries",
        message: "Seed search queries (comma-separated, or press enter for auto):",
        default: "",
      },
      {
        type: "list",
        name: "depth",
        message: "Research depth:",
        choices: ["shallow", "standard", "deep"],
        default: opts.depth,
      },
      {
        type: "list",
        name: "schedule",
        message: "Research schedule:",
        choices: ["hourly", "daily", "weekly"],
        default: opts.schedule,
      },
    ]);

    const searchQueries = answers.queries
      ? answers.queries.split(",").map((q: string) => q.trim()).filter(Boolean)
      : [`${topic} ${new Date().getFullYear()}`, topic];

    // Create the haunting
    const haunting = createHaunting(topic, answers.description, searchQueries, {
      schedule: {
        mode: "fixed",
        interval: answers.schedule,
      },
      research: {
        depth: answers.depth,
        max_sources_per_cycle: answers.depth === "deep" ? 15 : answers.depth === "shallow" ? 5 : 10,
        search_queries_base: searchQueries,
      },
    });

    // Register in database
    registerHaunting(haunting.id, haunting.config.name, haunting.config.description);

    console.log(`\n✅ Haunting created: "${haunting.config.name}"`);
    console.log(`   Location: ${haunting.path}`);
    console.log(`   Schedule: ${answers.schedule}`);
    console.log(`   Depth: ${answers.depth}`);
    console.log(`   Search queries: ${searchQueries.join(", ")}`);

    // Optionally run the first cycle
    if (opts.run) {
      console.log(`\n🔬 Running first research cycle...\n`);
      const result = await runCycle(haunting);
      console.log(`\n✅ First cycle complete!`);
      console.log(`   Observations: ${result.observationsAdded}`);
      console.log(`   Reflected: ${result.reflected}`);
      console.log(`   Notifications: ${result.notificationsSent}`);
    } else {
      console.log(`\nRun "ghost run ${haunting.id}" to start the first research cycle.`);
    }
  });
