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
## Instructions — FOLLOW THIS EXACT WORKFLOW

You have a LIMITED number of turns. Do NOT waste turns planning. Start searching IMMEDIATELY.

**Workflow — repeat this cycle:**
1. Search (WebSearch) for a focused query
2. Fetch (WebFetch) the most promising result
3. IMMEDIATELY save it as a JSON file (Write) — do NOT batch saves

**Query strategy:**
- Derive queries from the plan priorities AND the user's description
- Break the description into specific searchable topics
- Each query under 10 words

**Save rules:**
- Save EACH finding IMMEDIATELY after fetching — one search → one fetch → one save
- Save as src_<short_hash>.json in the current directory
- Do NOT wait to save all at once at the end — you will run out of turns

Research depth: ${haunting.config.research.depth}
Target: up to ${haunting.config.research.max_sources_per_cycle} sources.`;

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
        maxTurns: 30,
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
