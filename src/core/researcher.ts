import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Haunting } from "../memory/haunting.js";
import { RESEARCHER_SYSTEM_PROMPT } from "../prompts/researcher.js";
import { logger } from "../utils/logger.js";

function buildResearchPrompt(
  haunting: Haunting,
  plan: string,
  journal: string,
  context: string,
  purpose: string,
): string {
  const seedQueries = haunting.config.research.search_queries_base;

  let prompt = `You are researching the topic: "${haunting.config.name}"
Description: ${haunting.config.description}
`;

  if (context) {
    prompt += `
## Researcher Context (who you're researching for)
${context}
`;
  }

  if (purpose) {
    prompt += `
## Research Purpose (why this topic matters)
${purpose}
`;
  }

  prompt += `
## Current Research Plan (YOUR PRIMARY GUIDE — read this first)
${plan}

## Existing Knowledge (don't re-research what's already known)
${journal.slice(0, 8000)}
`;

  if (seedQueries.length > 0) {
    prompt += `
## Seed Queries (optional starting points — generate your own focused queries from the plan)
${seedQueries.map((q) => `- ${q}`).join("\n")}
`;
  }

  prompt += `
## Instructions
1. Read the plan above FIRST — the "Next" and "In Progress" items are your research priorities.
2. For each priority, generate 3-5 focused, specific search queries (under 10 words each).
3. Execute searches and fetch promising results.
4. Save each significant finding as a JSON file in the current directory (sources/).
5. Research depth: ${haunting.config.research.depth}
6. Target: find up to ${haunting.config.research.max_sources_per_cycle} significant sources.
7. Save each finding as src_<short_hash>.json in the current directory.

DO NOT use the raw topic name or description as a search query. Derive focused queries from the plan.`;

  return prompt;
}

export async function runResearch(
  haunting: Haunting,
  plan: string,
  journal: string,
  context: string,
  purpose: string,
): Promise<void> {
  const prompt = buildResearchPrompt(haunting, plan, journal, context, purpose);

  logger.info(`[researcher] Starting research for "${haunting.config.name}"`);

  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: RESEARCHER_SYSTEM_PROMPT,
        allowedTools: ["WebSearch", "WebFetch", "Bash", "Read", "Write"],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns: 25,
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
