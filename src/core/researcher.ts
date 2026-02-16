import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Haunting } from "../memory/haunting.js";
import { RESEARCHER_SYSTEM_PROMPT } from "../prompts/researcher.js";
import { logger } from "../utils/logger.js";

function buildResearchPrompt(
  haunting: Haunting,
  plan: string,
  journal: string,
): string {
  const seedQueries = haunting.config.research.search_queries_base;

  return `You are researching the topic: "${haunting.config.name}"
Description: ${haunting.config.description}

## Current Research Plan
${plan}

## Existing Knowledge (don't re-research what's already known)
${journal.slice(0, 8000)}

## Seed Search Queries
${seedQueries.map((q) => `- ${q}`).join("\n")}

## Instructions
1. Read the plan above and identify the top priority items to research this cycle.
2. Generate diverse search queries and execute them.
3. For each significant finding, save a structured JSON file to the current directory (sources/).
4. Research depth: ${haunting.config.research.depth}
5. Target: find up to ${haunting.config.research.max_sources_per_cycle} significant sources.
6. Save each finding as src_<short_hash>.json in the current directory.

Focus on the "Next" and "In Progress" items from the plan. Be thorough but efficient.`;
}

export async function runResearch(
  haunting: Haunting,
  plan: string,
  journal: string,
): Promise<void> {
  const prompt = buildResearchPrompt(haunting, plan, journal);

  logger.info(`[researcher] Starting research for "${haunting.config.name}"`);

  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: RESEARCHER_SYSTEM_PROMPT,
        allowedTools: ["WebSearch", "WebFetch", "Bash", "Read", "Write"],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns: 50,
        cwd: haunting.sourcesDir,
      },
    })) {
      if (message.type === "result") {
        if (message.subtype === "success") {
          logger.info(
            `[researcher] Completed. Cost: $${message.total_cost_usd?.toFixed(4) ?? "unknown"}`,
          );
        } else {
          logger.error(`[researcher] Failed: ${message.subtype}`);
        }
      }
    }
  } catch (err) {
    logger.error(`[researcher] Query failed: ${err}`);
    throw err;
  }
}
