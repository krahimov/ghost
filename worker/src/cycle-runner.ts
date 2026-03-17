import { query } from "@anthropic-ai/claude-agent-sdk";
import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex-api.js";
import {
  materialize,
  readBack,
  readSources,
  countSources,
  cleanup,
} from "./materializer.js";
import type { HauntingData } from "./materializer.js";

// --- System Prompts (same as CLI) ---

const RESEARCHER_SYSTEM_PROMPT = `You are Ghost's Research Agent. Your job is to gather information on a specific topic FOR A SPECIFIC USER.

You will be given:
- A research plan (plan.md) — THIS IS YOUR PRIMARY GUIDE for what to investigate
- The user's researcher context (who they are, what they're building — from context.md)
- The research purpose (why THIS topic matters to THIS user — from purpose.md)
- Existing knowledge (what's already known, so you don't repeat work)
- Optional seed queries (starting points only — you should generate your OWN focused queries)

## Context-Aware Research

You are not a generic research bot. You are a personal research analyst who understands the user's strategic position. Use the researcher context and purpose to:
- Generate search queries that are relevant to the user's specific needs, not just the topic generally
- Evaluate source relevance against what matters to THIS user (see purpose.md's "What Matters Most")
- Deprioritize findings that fall into "What Matters Less" from the purpose
- Look for competitive intelligence, product opportunities, and strategic implications specific to the user

## Query Strategy

**DO NOT use the raw topic name as a search query.** Instead:
1. Read the research plan carefully — the "Next" and "In Progress" items tell you exactly what to research
2. Break each plan item into 2-3 focused, specific search queries (under 10 words each)
3. Use the context and purpose to angle your queries toward what matters to the user
4. Add the current year (2026) to queries when looking for recent developments
5. If seed queries are provided, treat them as optional inspiration — refine or replace them

## Your Process
1. Read the plan, context, purpose, and existing knowledge carefully
2. Identify the top 2-3 priority items from the plan to research this cycle
3. Generate 3-5 focused search queries per priority item
4. Execute searches using WebSearch
5. For promising results, fetch full page content using WebFetch
6. Save each significant finding as a structured JSON file

For each finding, save a JSON file with this structure:
{
    "source_url": "https://...",
    "source_title": "...",
    "source_type": "paper|article|blog|docs|forum|official",
    "fetched_at": "2026-02-18T10:30:00Z",
    "relevance": 0.0-1.0,
    "strategic_relevance": "How this relates to the user's specific situation",
    "key_claims": ["claim 1", "claim 2"],
    "entities": ["entity1", "entity2"],
    "raw_excerpt": "The most relevant excerpt from the source (keep under 2000 chars)",
    "summary": "Your 2-3 sentence summary of what this source contributes"
}

## Guidelines
- **The plan is your compass.** Always start by reading what the plan says to research next.
- Be thorough but efficient. Don't spend all turns on one sub-topic.
- Prioritize primary sources (official docs, papers, company blogs) over secondary coverage.
- If you find something very significant or that contradicts existing knowledge, note it explicitly.
- Don't re-research things already covered in the existing knowledge.
- Save findings as individual JSON files named src_<short_hash>.json
- When scoring relevance, weight findings that directly impact the user's work higher than generically interesting ones.
- You have Bash access for cloning repos, running analysis tools, or other shell operations if needed.`;

const OBSERVER_SYSTEM_PROMPT = `You are Ghost's Observer Agent. Your role is to process raw research findings and update the research journal with structured observations.

You mimic how a human researcher takes notes: you observe what happened, note what's important, flag what's surprising, and connect new findings to existing knowledge.

## Context-Aware Observation

You are not just noting generic facts. You are noting what matters to a SPECIFIC user. You will have access to:
- context.md — who the user is, what they're building, their strategic position
- purpose.md — why this research topic matters to them, what findings are most/least valuable

USE THESE to calibrate your priority assignments:
- 🔴 Critical should mean "this directly impacts the user's work/product/strategy" — not just "this is a big development"
- 🟡 Notable should mean "this is useful for the user's understanding of their domain"
- ⚪ Incremental is for findings that are generically interesting but don't directly impact the user

## Observation Format

Each observation follows this format:

### [DATE] [TIME] — [Brief title]
**Priority**: 🔴 Critical | 🟡 Notable | ⚪ Incremental
**Source**: [URL or citation]
**Relates to**: [references to other observations or reflections, if any]
**Strategic relevance**: [One sentence on why this matters to the user specifically]

[2-4 sentence description of the finding in your own words]

**Key facts**:
- [Specific factual claims extracted from the source]
- [Data points, numbers, dates]

**Implications**: [What this means for the user's specific situation — their product, their market, their strategy]

**Open questions**: [New questions this raises, if any]

## Rules

1. **Deduplication**: If a finding is already covered in the journal or reflections, do NOT add it again.
2. **Contradiction detection**: If a finding contradicts an existing observation, add the new observation AND add a "⚠️ CONTRADICTION" note.
3. **Priority assignment** (calibrated to user context):
   - 🔴 Critical: Directly impacts the user's product/strategy, major competitive movement
   - 🟡 Notable: Adds meaningful knowledge relevant to the user's domain
   - ⚪ Incremental: Minor update, generically interesting but not strategically relevant
4. **Connections**: Always look for connections between new findings and existing knowledge.
5. **Provenance**: Every observation MUST link to its source.
6. **Timestamps**: Use ISO 8601 format for dates, HH:MM for times.
7. **Append, don't rewrite**: Add new observations to the END of the journal.

Read the existing journal.md, reflections.md, context.md (if it exists), purpose.md (if it exists), and all JSON files in sources/.
Then write the complete updated journal.md.`;

const REFLECTOR_SYSTEM_PROMPT = `You are Ghost's Reflector Agent. Your role is to compress and synthesize observations from the research journal into higher-level reflections — then garbage-collect the journal.

## Context-Aware Reflection

You are not just summarizing facts. You are synthesizing knowledge for a SPECIFIC user. Read:
- context.md — who the user is, what they're building, their strategic position
- purpose.md — why this topic matters to them

Use these to organize reflections around themes that matter to the user's business/goals.

## Your Task: Produce TWO outputs

### Output 1: Updated reflections.md
Merge older observations into the reflections document. Synthesize, don't summarize. Preserve critical data. Track evolution. Target 5-10x compression ratio.

### Output 2: Trimmed journal.md
Remove observations that have been absorbed into reflections. Keep ONLY:
- Observations from the most recent 2-3 cycles
- Any 🔴 Critical observations not fully incorporated into reflections
- Update the Summary section to reference reflections

Read context.md and purpose.md (if they exist).
Write the updated reflections.md and the trimmed journal.md.`;

const PLANNER_SYSTEM_PROMPT = `You are Ghost's Planner Agent. Your role is to maintain and update the research plan based on the current state of knowledge.

## Context-Aware Planning

Read context.md and purpose.md to plan research that serves the user's strategic needs.

## Planning Rules
1. Mark completed items based on journal/reflections findings
2. Update in-progress items with new sub-questions
3. Generate new objectives based on latest observations and user's strategic needs
4. Prioritize by strategic importance to the user
5. Prune stale items
6. Keep max 5 items in "Next" and 10 in "Backlog"

Read journal.md, reflections.md, plan.md, context.md (if it exists), and purpose.md (if it exists).
Then write the complete updated plan.md.`;

// --- Cycle Runner ---

export interface CycleContext {
  cycleId: string;
  hauntingId: string;
  userId: string;
  haunting: HauntingData;
  anthropicApiKey: string;
  convex: ConvexHttpClient;
}

export interface CycleResult {
  observationsAdded: number;
  sourcesFetched: number;
  reflected: boolean;
  planUpdated: boolean;
  notificationsSent: number;
  error?: string;
}

function estimateTokens(text: string): number {
  return Math.round(text.length / 4);
}

function countNewObservations(oldJournal: string, newJournal: string): number {
  const countHeaders = (text: string) =>
    (text.match(/^### \d{4}-\d{2}-\d{2}/gm) || []).length;
  return Math.max(0, countHeaders(newJournal) - countHeaders(oldJournal));
}

function buildResearchPrompt(
  haunting: HauntingData,
  sourcesDir: string,
): string {
  const seedQueries = haunting.research.searchQueriesBase;

  let prompt = `You are researching the topic: "${haunting.name}"
Description: ${haunting.description}
`;

  if (haunting.context) {
    prompt += `
## Researcher Context (who you're researching for)
${haunting.context}
`;
  }

  if (haunting.purpose) {
    prompt += `
## Research Purpose (why this topic matters)
${haunting.purpose}
`;
  }

  prompt += `
## Current Research Plan (YOUR PRIMARY GUIDE — read this first)
${haunting.plan}

## Existing Knowledge (don't re-research what's already known)
${haunting.journal.slice(0, 8000)}
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
- Save using ABSOLUTE paths to this directory: ${sourcesDir}/
- File name pattern: ${sourcesDir}/src_<short_hash>.json
- The Write tool requires absolute paths — always use the full path above
- Do NOT wait to save all at once at the end — you will run out of turns

Research depth: ${haunting.research.depth}
Target: up to ${haunting.research.maxSourcesPerCycle} sources.`;

  return prompt;
}

async function updatePhase(
  convex: ConvexHttpClient,
  cycleId: string,
  phase: string,
  phaseNumber: number,
  extra?: { sourcesFetched?: number; observationsAdded?: number },
) {
  await convex.mutation(api.cycles.updatePhase, {
    id: cycleId,
    currentPhase: phase,
    phaseNumber,
    ...extra,
  });
}

async function updateHaunting(
  convex: ConvexHttpClient,
  hauntingId: string,
  updates: {
    journal?: string;
    reflections?: string;
    plan?: string;
  },
) {
  await convex.mutation(api.hauntings.updateFromCycle, {
    id: hauntingId,
    ...updates,
  });
}

/**
 * Parse significant findings from the journal for notifications.
 */
function extractSignificantFindings(
  journal: string,
  threshold: number = 0.8,
): Array<{ title: string; source: string; priority: string }> {
  const findings: Array<{ title: string; source: string; priority: string }> =
    [];
  const obsRegex =
    /### (\d{4}-\d{2}-\d{2}[^\n]*)\n\*\*Priority\*\*:\s*(🔴[^\n]*)/g;
  let match;

  while ((match = obsRegex.exec(journal)) !== null) {
    const title = match[1].trim();
    const priority = match[2].includes("Critical") ? "critical" : "notable";

    // Get source line
    const sourceMatch = journal
      .slice(match.index)
      .match(/\*\*Source\*\*:\s*([^\n]+)/);
    const source = sourceMatch ? sourceMatch[1].trim() : "";

    if (priority === "critical") {
      findings.push({ title, source, priority });
    }
  }

  return findings;
}

/**
 * Pushes an activity event to Convex for the frontend activity feed.
 */
async function pushActivity(
  convex: ConvexHttpClient,
  cycleId: string,
  hauntingId: string,
  phase: string,
  type: string,
  title: string,
  detail?: string,
  url?: string,
) {
  try {
    await convex.mutation(api.cycleActivity.insert, {
      cycleId,
      hauntingId,
      phase,
      type,
      title,
      detail,
      url,
    });
  } catch {
    // Don't let activity logging failures break the cycle
  }
}

/**
 * Extracts tool use events from Agent SDK messages and pushes them to Convex.
 * Returns the message for further processing.
 */
async function processAgentMessage(
  message: any,
  convex: ConvexHttpClient,
  cycleId: string,
  hauntingId: string,
  phase: string,
) {
  // The Agent SDK yields messages with content arrays containing tool_use blocks
  if (message.type === "assistant" && Array.isArray(message.content)) {
    for (const block of message.content) {
      if (block.type === "tool_use") {
        const toolName = block.name;
        const input = block.input || {};

        if (toolName === "WebSearch") {
          const searchQuery = input.query || "";
          console.log(`  🔍 Search: ${searchQuery}`);
          await pushActivity(
            convex,
            cycleId,
            hauntingId,
            phase,
            "search",
            searchQuery,
          );
        } else if (toolName === "WebFetch") {
          const fetchUrl = input.url || "";
          console.log(`  🌐 Fetch: ${fetchUrl}`);
          await pushActivity(
            convex,
            cycleId,
            hauntingId,
            phase,
            "fetch",
            fetchUrl.length > 80 ? fetchUrl.slice(0, 80) + "…" : fetchUrl,
            undefined,
            fetchUrl,
          );
        } else if (toolName === "Write") {
          const filePath = input.file_path || input.path || "";
          if (filePath.includes("src_") && filePath.endsWith(".json")) {
            console.log(`  💾 Source saved: ${filePath.split("/").pop()}`);
            await pushActivity(
              convex,
              cycleId,
              hauntingId,
              phase,
              "source_saved",
              `Source saved: ${filePath.split("/").pop()}`,
            );
          } else if (filePath.includes("journal")) {
            await pushActivity(
              convex,
              cycleId,
              hauntingId,
              phase,
              "info",
              "Updated journal with new observations",
            );
          } else if (filePath.includes("reflections")) {
            await pushActivity(
              convex,
              cycleId,
              hauntingId,
              phase,
              "info",
              "Updated reflections",
            );
          } else if (filePath.includes("plan")) {
            await pushActivity(
              convex,
              cycleId,
              hauntingId,
              phase,
              "info",
              "Updated research plan",
            );
          }
        }
      }
    }
  }
}

export async function runCycle(ctx: CycleContext): Promise<CycleResult> {
  const { cycleId, hauntingId, userId, haunting, anthropicApiKey, convex } =
    ctx;
  const startTime = Date.now();

  console.log(`\n=== Starting research cycle for "${haunting.name}" ===`);

  const result: CycleResult = {
    observationsAdded: 0,
    sourcesFetched: 0,
    reflected: false,
    planUpdated: false,
    notificationsSent: 0,
  };

  // Materialize Convex data to temp files
  const tmpDir = materialize(haunting);
  console.log(`  Materialized to ${tmpDir}`);

  try {
    // Auth: If a user-provided API key exists, use it.
    // Otherwise (CLAUDE_DEV mode), DELETE any stale key from the env so
    // the claude subprocess falls back to account auth (`claude login`).
    if (anthropicApiKey) {
      process.env.ANTHROPIC_API_KEY = anthropicApiKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }

    // ──────────────────────────────────
    // Phase 1: Research
    // ──────────────────────────────────
    console.log(`\n⏳ Phase 1/5: Research`);
    await updatePhase(convex, cycleId, "research", 1);

    const sourcesDir = `${tmpDir}/sources`;
    const researchPrompt = buildResearchPrompt(haunting, sourcesDir);

    try {
      for await (const message of query({
        prompt: researchPrompt,
        options: {
          systemPrompt: RESEARCHER_SYSTEM_PROMPT,
          allowedTools: ["WebSearch", "WebFetch", "Bash", "Read", "Write"],
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          maxTurns: 30,
          cwd: sourcesDir,
        },
      })) {
        await processAgentMessage(message, convex, cycleId, hauntingId, "research");
        if (message.type === "result") {
          if (message.subtype === "success") {
            console.log(
              `  ✓ Research complete. Cost: $${message.total_cost_usd?.toFixed(4) ?? "?"}`,
            );
          } else {
            console.log(`  ⚠ Research ended: ${message.subtype}`);
          }
        }
      }
    } catch (err) {
      console.error(`  ✗ Research failed: ${err}`);
      await pushActivity(convex, cycleId, hauntingId, "research", "error", `Research failed: ${err}`);
      throw err;
    }

    // Debug: check what files exist after research
    const fs = await import("node:fs");
    const allSourceFiles = fs.readdirSync(sourcesDir);
    console.log(`  [debug] Files in sources dir: ${JSON.stringify(allSourceFiles)}`);
    const allTmpFiles = fs.readdirSync(tmpDir);
    console.log(`  [debug] Files in tmpDir: ${JSON.stringify(allTmpFiles)}`);

    const sourceCount = countSources(tmpDir);
    result.sourcesFetched = sourceCount;
    await updatePhase(convex, cycleId, "research", 1, {
      sourcesFetched: sourceCount,
    });
    console.log(`  ${sourceCount} sources collected`);

    // ──────────────────────────────────
    // Phase 2: Observe
    // ──────────────────────────────────
    console.log(`\n⏳ Phase 2/5: Observe`);
    await updatePhase(convex, cycleId, "observe", 2, {
      sourcesFetched: sourceCount,
    });

    const observerPrompt = `Process the new research results and update the journal.

Your working directory is: ${tmpDir}

Read the following files (use absolute paths):
- ${tmpDir}/journal.md (current observations)
- ${tmpDir}/reflections.md (accumulated reflections)
- ${tmpDir}/context.md (researcher context — read this if it exists)
- ${tmpDir}/purpose.md (research purpose — read this if it exists)
- All JSON files in ${sourcesDir}/ (new research results from this cycle)

Then write the updated ${tmpDir}/journal.md with new observations integrated.
Use context.md and purpose.md to calibrate priority assignments.

Current journal length: ${haunting.journal.length} characters
Has reflections: ${haunting.reflections.length > 100 ? "yes" : "no"}
Has context: ${haunting.context ? "yes" : "no"}
Has purpose: ${haunting.purpose ? "yes" : "no"}`;

    try {
      for await (const message of query({
        prompt: observerPrompt,
        options: {
          systemPrompt: OBSERVER_SYSTEM_PROMPT,
          allowedTools: ["Read", "Write", "Glob"],
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          model: "claude-opus-4-6",
          maxTurns: 30,
          cwd: tmpDir,
        },
      })) {
        await processAgentMessage(message, convex, cycleId, hauntingId, "observe");
        if (message.type === "result") {
          if (message.subtype === "success") {
            console.log(
              `  ✓ Observer complete. Cost: $${message.total_cost_usd?.toFixed(4) ?? "?"}`,
            );
          } else {
            console.log(`  ⚠ Observer ended: ${message.subtype}`);
          }
        }
      }
    } catch (err) {
      console.error(`  ✗ Observer failed: ${err}`);
      throw err;
    }

    // Read back updated journal and sync to Convex
    const afterObserve = readBack(tmpDir);
    result.observationsAdded = countNewObservations(
      haunting.journal,
      afterObserve.journal,
    );
    await updatePhase(convex, cycleId, "observe", 2, {
      sourcesFetched: sourceCount,
      observationsAdded: result.observationsAdded,
    });
    await updateHaunting(convex, hauntingId, {
      journal: afterObserve.journal,
    });
    console.log(`  ${result.observationsAdded} new observations added`);

    // ──────────────────────────────────
    // Phase 3: Reflect (conditional)
    // ──────────────────────────────────
    const reflectorThreshold =
      haunting.reflectorConfig?.journalTokenThreshold ?? 15000;
    const journalTokens = estimateTokens(afterObserve.journal);

    if (journalTokens > reflectorThreshold) {
      console.log(
        `\n⏳ Phase 3/5: Reflect (journal at ${journalTokens} tokens)`,
      );
      await updatePhase(convex, cycleId, "reflect", 3);

      const reflectorPrompt = `The journal has grown beyond the token threshold and needs reflection/compression.

Your working directory is: ${tmpDir}

Read (use absolute paths):
- ${tmpDir}/journal.md (current journal with many observations)
- ${tmpDir}/reflections.md (existing reflections, if any)
- ${tmpDir}/context.md (researcher context, if it exists)
- ${tmpDir}/purpose.md (research purpose, if it exists)

Then:
1. Write an updated ${tmpDir}/reflections.md that synthesizes older observations into themes
2. Write a trimmed ${tmpDir}/journal.md that only keeps the most recent observations

Current journal length: ${afterObserve.journal.length} characters (~${journalTokens} tokens)
Current reflections length: ${afterObserve.reflections.length} characters`;

      try {
        for await (const message of query({
          prompt: reflectorPrompt,
          options: {
            systemPrompt: REFLECTOR_SYSTEM_PROMPT,
            allowedTools: ["Read", "Write", "Glob"],
            permissionMode: "bypassPermissions",
            allowDangerouslySkipPermissions: true,
            maxTurns: 30,
            cwd: tmpDir,
          },
        })) {
          await processAgentMessage(message, convex, cycleId, hauntingId, "reflect");
          if (message.type === "result") {
            if (message.subtype === "success") {
              console.log(
                `  ✓ Reflector complete. Cost: $${message.total_cost_usd?.toFixed(4) ?? "?"}`,
              );
            }
          }
        }
      } catch (err) {
        console.error(`  ✗ Reflector failed: ${err}`);
        // Non-fatal — continue with planning
      }

      const afterReflect = readBack(tmpDir);
      result.reflected = true;
      await updateHaunting(convex, hauntingId, {
        journal: afterReflect.journal,
        reflections: afterReflect.reflections,
      });
      console.log(`  Reflections updated`);
    } else {
      console.log(
        `\n⏳ Phase 3/5: Reflect — skipped (${journalTokens}/${reflectorThreshold} tokens)`,
      );
    }

    // ──────────────────────────────────
    // Phase 4: Plan
    // ──────────────────────────────────
    console.log(`\n⏳ Phase 4/5: Plan`);
    await updatePhase(convex, cycleId, "plan", 4);

    const plannerPrompt = `Update the research plan based on the latest knowledge.

Your working directory is: ${tmpDir}

Read (use absolute paths):
- ${tmpDir}/journal.md (recent observations)
- ${tmpDir}/reflections.md (accumulated knowledge)
- ${tmpDir}/plan.md (current plan)
- ${tmpDir}/context.md (researcher context, if it exists)
- ${tmpDir}/purpose.md (research purpose, if it exists)

Then write the updated ${tmpDir}/plan.md with:
- Completed items marked as done
- New objectives generated from findings
- Priorities reordered based on strategic importance`;

    try {
      for await (const message of query({
        prompt: plannerPrompt,
        options: {
          systemPrompt: PLANNER_SYSTEM_PROMPT,
          allowedTools: ["Read", "Write", "Glob"],
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          maxTurns: 30,
          cwd: tmpDir,
        },
      })) {
        await processAgentMessage(message, convex, cycleId, hauntingId, "plan");
        if (message.type === "result") {
          if (message.subtype === "success") {
            console.log(
              `  ✓ Planner complete. Cost: $${message.total_cost_usd?.toFixed(4) ?? "?"}`,
            );
          }
        }
      }
    } catch (err) {
      console.error(`  ✗ Planner failed: ${err}`);
      // Non-fatal
    }

    const afterPlan = readBack(tmpDir);
    result.planUpdated = true;
    await updateHaunting(convex, hauntingId, {
      plan: afterPlan.plan,
    });
    console.log(`  Plan updated`);

    // ──────────────────────────────────
    // Phase 5: Notify + Persist Sources
    // ──────────────────────────────────
    console.log(`\n⏳ Phase 5/5: Notify`);
    await updatePhase(convex, cycleId, "notify", 5);

    // Persist sources to Convex
    const sources = readSources(tmpDir);
    for (const src of sources) {
      try {
        await convex.mutation(api.sources.insert, {
          hauntingId,
          cycleId,
          url: src.source_url || src.url || "",
          title: src.source_title || src.title || "Untitled",
          sourceType: src.source_type,
          fetchedAt: src.fetched_at
            ? new Date(src.fetched_at).getTime()
            : Date.now(),
          relevance: src.relevance,
          summary: src.summary,
          rawExcerpt: src.raw_excerpt,
          keyClaims: src.key_claims,
          entities: src.entities,
          strategicRelevance: src.strategic_relevance,
        });
      } catch (err) {
        console.error(`  ⚠ Failed to persist source: ${err}`);
      }
    }
    console.log(`  ${sources.length} sources persisted to Convex`);

    // Create notifications for critical findings
    const finalJournal = afterPlan.journal || afterObserve.journal;
    const significantFindings = extractSignificantFindings(finalJournal);

    for (const finding of significantFindings) {
      try {
        await convex.mutation(api.notifications.insert, {
          userId,
          hauntingId,
          cycleId,
          type: "finding",
          priority: finding.priority,
          title: finding.title,
          summary: `Critical finding: ${finding.title}`,
          sourceUrl: finding.source || undefined,
        });
        result.notificationsSent++;
      } catch (err) {
        console.error(`  ⚠ Failed to create notification: ${err}`);
      }
    }

    // Always send a cycle_complete notification
    try {
      await convex.mutation(api.notifications.insert, {
        userId,
        hauntingId,
        cycleId,
        type: "cycle_complete",
        priority: "incremental",
        title: `Cycle complete: ${haunting.name}`,
        summary: `Research cycle completed. ${result.sourcesFetched} sources, ${result.observationsAdded} observations.`,
      });
      result.notificationsSent++;
    } catch (err) {
      console.error(`  ⚠ Failed to create completion notification: ${err}`);
    }

    console.log(`  ${result.notificationsSent} notifications sent`);
  } catch (err) {
    result.error = String(err);
    console.error(`\n✗ Cycle failed: ${err}`);
  } finally {
    // Clean up temp directory
    cleanup(tmpDir);
    // Clear the API key from env if we set it
    if (anthropicApiKey) {
      delete process.env.ANTHROPIC_API_KEY;
    }
  }

  // Complete the cycle in Convex
  try {
    await convex.mutation(api.cycles.complete, {
      id: cycleId,
      hauntingId,
      observationsAdded: result.observationsAdded,
      sourcesFetched: result.sourcesFetched,
      reflected: result.reflected,
      planUpdated: result.planUpdated,
      notificationsSent: result.notificationsSent,
      error: result.error,
    });
  } catch (err) {
    console.error(`Failed to complete cycle in Convex: ${err}`);
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  if (result.error) {
    console.log(`\n✗ Cycle failed in ${timeStr}: ${result.error}`);
  } else {
    console.log(
      `\n✓ Cycle complete in ${timeStr}: ${result.observationsAdded} observations, ${result.sourcesFetched} sources, reflected: ${result.reflected}`,
    );
  }

  return result;
}
