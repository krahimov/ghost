import { Command } from "commander";
import inquirer from "inquirer";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { createHaunting, loadHaunting } from "../memory/haunting.js";
import { registerHaunting } from "../memory/store.js";
import { getGhostHome, ensureDir } from "../utils/paths.js";
import { runCycle } from "../core/cycle.js";
import { printCycleReport, generateReport } from "../core/report.js";
import { readContext, hasContext, writePurpose } from "../memory/context.js";
import { logger } from "../utils/logger.js";
import fs from "node:fs";

const PURPOSE_GENERATION_PROMPT = `You are Ghost, an autonomous research agent. The user has a global researcher context (who they are, what they're building) and is now creating a new research mission (haunting) on a specific topic.

Generate a purpose.md file that connects this specific research topic to the user's strategic context. This file tells every research agent WHY this topic matters to THIS user, what findings are most valuable, and how to evaluate relevance.

Output ONLY the markdown content, no code fences. Use this structure:

# Purpose: [Topic Name]

## Connection to [User's Company/Project]
[How this research topic relates to their work. 2-3 sentences.]

## What Matters Most
[Bullet list of the highest-value finding types for this user]

## What Matters Less
[Bullet list of finding types that are less relevant to their specific needs]

## Strategic Questions
[3-5 specific questions this research should help answer, tailored to the user's position]`;

const SEED_QUERY_PROMPT = `You are a research query generator. Given a research topic, description, and optional user context, generate 5 focused, specific search queries that would yield the most valuable results.

Rules:
- Each query should be under 10 words
- Queries should be diverse — cover different angles of the topic
- Include the year 2026 in at least 2 queries for recency
- If user context is provided, angle queries toward their specific needs
- Output ONLY the queries, one per line, no numbering, no bullets, no extra text`;

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

    // Generate smart seed queries via LLM
    console.log(`\n🔍 Generating research queries...`);
    const searchQueries = await generateSeedQueries(topic, answers.description);
    console.log(`   Generated ${searchQueries.length} seed queries:`);
    for (const q of searchQueries) {
      console.log(`   - ${q}`);
    }

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

    // Generate purpose.md if we have context
    if (hasContext()) {
      console.log(`\n🧠 Generating research purpose (connecting to your context)...\n`);
      await generatePurpose(haunting.id, topic, answers.description);
    }

    console.log(`\n✅ Haunting created: "${haunting.config.name}"`);
    console.log(`   Location: ${haunting.path}`);
    console.log(`   Schedule: ${answers.schedule}`);
    console.log(`   Depth: ${answers.depth}`);

    // Optionally run the first cycle
    if (opts.run) {
      console.log(`\n🔬 Running first research cycle...\n`);
      const loadedHaunting = loadHaunting(haunting.id);
      const result = await runCycle(loadedHaunting);

      // Display full report
      printCycleReport(loadedHaunting, result);

      // Save report to file
      const reportPath = generateReport(loadedHaunting, result);
      console.log(`📄 Report saved: ${reportPath}\n`);
    } else {
      console.log(`\nRun "ghost run ${haunting.id}" to start the first research cycle.`);
    }
  });

async function generateSeedQueries(
  topic: string,
  description: string,
): Promise<string[]> {
  const context = hasContext() ? readContext() : "";

  let prompt = `Topic: "${topic}"
Description: ${description}`;

  if (context) {
    prompt += `\n\nUser context:\n${context}`;
  }

  prompt += `\n\nGenerate 5 focused search queries for this research topic.`;

  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: SEED_QUERY_PROMPT,
        allowedTools: [],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns: 3,
      },
    })) {
      if (message.type === "result" && message.subtype === "success" && message.result) {
        return message.result
          .split("\n")
          .map((q: string) => q.trim())
          .filter((q: string) => q.length > 0 && q.length < 100);
      }
    }
  } catch (err) {
    logger.error(`Failed to generate seed queries: ${err}`);
  }

  // Fallback: simple queries derived from topic words
  const words = topic.split(/\s+/).slice(0, 5).join(" ");
  return [`${words} 2026`, `${words} latest research`];
}

async function generatePurpose(
  hauntingId: string,
  topic: string,
  description: string,
): Promise<void> {
  const context = readContext();

  const prompt = `Here is the user's global researcher context:

${context}

They are creating a new research mission on: "${topic}"
Description: ${description}

Generate the purpose.md file that connects this research topic to their strategic context.`;

  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: PURPOSE_GENERATION_PROMPT,
        allowedTools: [],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns: 3,
      },
    })) {
      if (message.type === "result" && message.subtype === "success" && message.result) {
        const haunting = loadHaunting(hauntingId);
        writePurpose(haunting, message.result);
        console.log(`✅ Research purpose generated`);
        console.log(`\n--- Research Purpose ---`);
        console.log(message.result.slice(0, 500) + (message.result.length > 500 ? "\n..." : ""));
        console.log(`------------------------\n`);
      }
    }
  } catch (err) {
    logger.error(`Failed to generate purpose: ${err}`);
    console.log(`⚠️  Could not auto-generate purpose. You can create purpose.md manually.`);
  }
}
