# Ghost — Architecture & Specification

## Overview

Ghost is an autonomous, always-on research agent that continuously investigates topics you care about, builds a compounding knowledge base over time, and proactively notifies you when it discovers something significant. Think of it as a personal research analyst that never sleeps.

Unlike one-shot research tools (Perplexity, ChatGPT deep research), Ghost **compounds knowledge over days and weeks**. After running for a month on a topic, it doesn't just know today's news — it knows the full timeline, the key players, what changed and when, and can answer synthetic questions like "how has the Commission's stance shifted since October?"

Ghost is built on the **Claude Agent SDK** (TypeScript) and uses Claude as its intelligence layer for all reasoning, observation, reflection, and planning.

---

## Core Concepts

### Hauntings

A **haunting** is a persistent research mission. When a user tells Ghost "track simulation environments for RL agents," that creates a haunting. Each haunting has its own directory with its own journal, reflections, and plan. A user can have multiple hauntings running simultaneously.

### The Three-Tier Memory System (Inspired by Mastra's Observational Memory)

Ghost uses a three-tier memory architecture inspired by Mastra AI's Observational Memory pattern, but adapted for **research** rather than conversation compression:

**Tier 1 — Raw Research Results (ephemeral)**
When Ghost runs a research cycle, it searches the web, fetches pages, reads papers, etc. The raw content is cached in `sources/` and optionally chunked into a vector store. This is working material — most of it gets processed and discarded from active context.

**Tier 2 — Observations (journal.md)**
After each research cycle, an **Observer** agent processes raw results against the existing journal and produces timestamped, prioritized observations. This is the core knowledge base — structured notes about what's been discovered, tagged with priority, source links, and relationships to existing knowledge.

The Observer is inspired by Mastra's Observer agent, but triggers **per research cycle** (not per token threshold), and the observations are about **domain knowledge** (not conversation turns).

**Tier 3 — Reflections (reflections.md)**
When the journal grows beyond a token threshold, a **Reflector** agent compresses older observations into higher-level patterns, trends, and conclusions. This keeps the journal dense and useful rather than growing unboundedly. The reflections represent the highest-level understanding Ghost has built.

Again inspired by Mastra's Reflector, but operating on accumulated research observations rather than conversation history.

### The Research Plan (plan.md)

After each Observer pass, a **Planner** agent reads the updated journal and generates/updates a structured plan of what to research next. The plan contains:

- The high-level research objective
- Completed research items (with pointers to journal entries)
- In-progress items
- Next items (generated from the last cycle's findings)
- A backlog of lower-priority questions

The plan is the bridge to future sub-agent support. For now, the main agent works through plan items itself. Later, each item can become a task dispatched to a sub-agent.

### Research Cycles

A research cycle is Ghost's core unit of work. It can be triggered on a schedule (cron) or manually. Each cycle:

1. Reads current state (journal, reflections, plan)
2. Picks objectives from the plan
3. Researches (web search, fetch, read)
4. Observes (updates journal.md with findings)
5. Reflects (if journal exceeds threshold, compresses into reflections.md)
6. Plans (updates plan.md with new objectives)
7. Notifies (if significant findings detected)

---

## Tech Stack

- **Runtime**: Node.js 20+ / TypeScript 5+
- **Agent framework**: Claude Agent SDK (TypeScript) — `@anthropic-ai/claude-agent-sdk`
- **LLM**: Claude (via the Agent SDK, which wraps Claude Code's capabilities)
- **Storage**: `better-sqlite3` for metadata + optional vector embeddings
- **Scheduling**: `node-cron` for daemon mode
- **CLI**: `commander` for commands + `inquirer` for interactive prompts
- **Notifications**: Initially just console/log output. Later: email, Slack webhook, Telegram
- **Validation**: `zod` for config and schema validation
- **Testing**: `vitest`
- **Build**: `tsup` for production builds, `tsx` for development

---

## Project Structure

```
ghost/
├── CLAUDE.md                    # Project-level instructions for Claude Code
├── docs/
│   └── architecture.md          # This file
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                 # CLI entrypoint
│   ├── cli/
│   │   ├── index.ts             # Commander program setup
│   │   ├── haunt.ts             # ghost haunt command
│   │   ├── run.ts               # ghost run command
│   │   ├── chat.ts              # ghost chat command
│   │   ├── list.ts              # ghost list command
│   │   ├── status.ts            # ghost status command
│   │   └── daemon.ts            # ghost daemon command
│   ├── config/
│   │   ├── index.ts             # Config loading/validation
│   │   ├── schema.ts            # Zod schemas for config
│   │   └── defaults.ts          # Default configuration values
│   ├── core/
│   │   ├── cycle.ts             # Research cycle orchestration
│   │   ├── researcher.ts        # Research execution (search + fetch)
│   │   ├── observer.ts          # Observer agent (Tier 2)
│   │   ├── reflector.ts         # Reflector agent (Tier 3)
│   │   └── planner.ts           # Planner agent
│   ├── memory/
│   │   ├── journal.ts           # Journal read/write/parse operations
│   │   ├── reflections.ts       # Reflections read/write/compress
│   │   ├── plan.ts              # Plan read/write/update
│   │   ├── store.ts             # SQLite store for metadata + sources
│   │   └── haunting.ts          # Haunting model and lifecycle
│   ├── notifications/
│   │   ├── index.ts             # Notification dispatch
│   │   └── channels/
│   │       └── console.ts       # Console notification channel
│   ├── prompts/
│   │   ├── observer.ts          # Observer system prompt
│   │   ├── reflector.ts         # Reflector system prompt
│   │   ├── planner.ts           # Planner system prompt
│   │   └── researcher.ts        # Researcher system prompt
│   └── utils/
│       ├── tokens.ts            # Token counting utilities
│       ├── logger.ts            # Logging setup
│       └── paths.ts             # Path resolution helpers
├── tests/
│   ├── cycle.test.ts
│   ├── observer.test.ts
│   ├── reflector.test.ts
│   ├── planner.test.ts
│   └── journal.test.ts
└── data/                        # Default data directory (configurable)
    └── hauntings/
        └── example-topic/
            ├── journal.md
            ├── reflections.md
            ├── plan.md
            ├── config.yaml
            └── sources/
```

---

## Data Directory Structure

Each haunting lives in its own directory:

```
~/.ghost/                          # Default Ghost home (configurable via GHOST_HOME env var)
├── config.yaml                    # Global config
├── ghost.db                       # SQLite database
└── hauntings/
    └── rl-sim-environments/       # One directory per haunting
        ├── config.yaml            # Haunting-specific config (schedule, depth, etc.)
        ├── journal.md             # Tier 2: Observations log
        ├── reflections.md         # Tier 3: Compressed reflections
        ├── plan.md                # Research plan / objectives
        ├── history/               # Versioned snapshots (git-style)
        │   ├── journal_2026-02-14.md
        │   └── plan_2026-02-14.md
        └── sources/               # Cached raw content from research
            ├── src_a1b2c3.json    # Raw fetch result with metadata
            └── src_d4e5f6.json
```

---

## Configuration

### Global Config (~/.ghost/config.yaml)

```yaml
ghost:
  home: ~/.ghost
  default_model: opus              # Default Claude model for agent SDK
  log_level: info

notifications:
  enabled: false
  channels:
    console:
      enabled: true
    # Future: email, slack, telegram

defaults:
  schedule: "daily"
  observer:
    priority_threshold: 0.6
  reflector:
    journal_token_threshold: 30000
  planner:
    max_next_items: 5
```

### Zod Schema (src/config/schema.ts)

```typescript
import { z } from "zod";

export const NotificationChannelSchema = z.object({
  enabled: z.boolean().default(false),
});

export const GlobalConfigSchema = z.object({
  ghost: z.object({
    home: z.string().default("~/.ghost"),
    default_model: z.string().default("opus"),
    log_level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  }),
  notifications: z.object({
    enabled: z.boolean().default(false),
    channels: z.object({
      console: NotificationChannelSchema.default({ enabled: true }),
    }),
  }),
  defaults: z.object({
    schedule: z.string().default("daily"),
    observer: z.object({
      priority_threshold: z.number().default(0.6),
    }),
    reflector: z.object({
      journal_token_threshold: z.number().default(30000),
    }),
    planner: z.object({
      max_next_items: z.number().default(5),
    }),
  }),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;

export const HauntingConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  created: z.string(),
  status: z.enum(["active", "paused", "completed"]).default("active"),
  schedule: z.object({
    mode: z.enum(["fixed", "autonomous"]).default("fixed"),
    interval: z.enum(["hourly", "daily", "weekly"]).default("daily"),
    cron: z.string().optional(),
  }),
  research: z.object({
    depth: z.enum(["shallow", "standard", "deep"]).default("standard"),
    max_sources_per_cycle: z.number().default(10),
    search_queries_base: z.array(z.string()).default([]),
  }),
  observer: z.object({
    priority_threshold: z.number().default(0.5),
  }).optional(),
  reflector: z.object({
    journal_token_threshold: z.number().default(25000),
  }).optional(),
});

export type HauntingConfig = z.infer<typeof HauntingConfigSchema>;
```

### Haunting Config (per-haunting config.yaml)

```yaml
name: "RL Simulation Environments"
description: "Track and analyze simulation environments used for RL agent training"
created: "2026-02-16T10:00:00Z"
status: active

schedule:
  mode: fixed
  interval: daily

research:
  depth: standard
  max_sources_per_cycle: 10
  search_queries_base:
    - "RL simulation environments 2026"
    - "robot learning simulation frameworks"
    - "sim-to-real transfer reinforcement learning"
```

---

## Detailed Component Specifications

### 1. CLI (src/cli/)

The CLI is the primary user interface. Use `commander` for command structure and `inquirer` for interactive prompts.

```
ghost init                              # Initialize Ghost home directory
ghost haunt <topic>                     # Create a new haunting (interactive setup)
ghost haunt <topic> --schedule daily    # Create with specific schedule
ghost list                              # List all hauntings with status
ghost status <haunting>                 # Show detailed status of a haunting
ghost run <haunting>                    # Manually trigger a research cycle
ghost run --all                         # Run all active hauntings
ghost chat <haunting>                   # Enter chat mode to query accumulated knowledge
ghost plan <haunting>                   # Show current research plan
ghost journal <haunting>                # Show current journal (with optional --tail N)
ghost pause <haunting>                  # Pause a haunting
ghost resume <haunting>                 # Resume a paused haunting
ghost daemon                            # Start Ghost in daemon mode (runs scheduler)
ghost config                            # Edit global config
ghost config <haunting>                 # Edit haunting config
```

#### `ghost haunt` flow:

When the user runs `ghost haunt "RL simulation environments"`, Ghost should:

1. Create the haunting directory structure
2. Start a conversational setup using a Claude Agent SDK query:
   - Ask clarifying questions about what specifically to track
   - Ask about desired depth and frequency
   - Generate initial seed search queries
   - Generate the initial plan.md with research objectives
3. Save the config.yaml with the configuration
4. Optionally run the first research cycle immediately

#### `ghost chat` flow:

Opens an interactive chat session where the user can query the accumulated knowledge. Each user message triggers a Claude Agent SDK query with the haunting's journal.md, reflections.md, and plan.md injected as context. The agent can also search the sources/ directory for raw data if needed.

The chat should feel like talking to a research analyst who has been following this topic for you. It should be able to:
- Answer factual questions from accumulated knowledge
- Synthesize across multiple observations
- Identify trends and patterns
- Point to specific sources for claims
- Suggest what to research next

### 2. Research Cycle Orchestration (src/core/cycle.ts)

This is the main orchestration loop. A single research cycle executes these steps in order:

```typescript
import { query, type ClaudeAgentOptions } from "@anthropic-ai/claude-agent-sdk";
import type { Haunting } from "../memory/haunting.js";

interface CycleResult {
  observationsAdded: number;
  reflected: boolean;
  newPlanItems: number;
  notificationsSent: number;
}

export async function runCycle(haunting: Haunting): Promise<CycleResult> {
  // 1. Load current state
  const journal = await readJournal(haunting);
  const reflections = await readReflections(haunting);
  const plan = await readPlan(haunting);

  // 2. Research phase — execute research based on plan objectives
  const researchResults = await runResearch(haunting, plan, journal);

  // 3. Observer phase — process results into observations
  const updatedJournal = await runObserver(haunting, journal, reflections, researchResults);
  await writeJournal(haunting, updatedJournal);

  // 4. Reflection phase — compress if needed
  let reflected = false;
  if (countTokens(updatedJournal) > haunting.config.reflector.journalTokenThreshold) {
    const { reflections: updatedReflections, trimmedJournal } = await runReflector(
      haunting,
      updatedJournal,
      reflections
    );
    await writeReflections(haunting, updatedReflections);
    await writeJournal(haunting, trimmedJournal);
    reflected = true;
  }

  // 5. Planning phase — update plan based on new knowledge
  const updatedPlan = await runPlanner(haunting, updatedJournal, reflections, plan);
  await writePlan(haunting, updatedPlan);

  // 6. Notification phase — check for significant findings
  const significantFindings = extractSignificantFindings(updatedJournal, 0.8);
  if (significantFindings.length > 0) {
    await notify(haunting, significantFindings);
  }

  // 7. Snapshot for history
  await saveSnapshot(haunting);

  return {
    observationsAdded: /* count new observations */,
    reflected,
    newPlanItems: /* count new plan items */,
    notificationsSent: significantFindings.length,
  };
}
```

### 3. Researcher (src/core/researcher.ts)

The researcher executes the actual information gathering. It uses the Claude Agent SDK with web search and bash tools to find and retrieve information.

```typescript
import { query, type ClaudeAgentOptions } from "@anthropic-ai/claude-agent-sdk";
import { RESEARCHER_SYSTEM_PROMPT } from "../prompts/researcher.js";

export async function runResearch(
  haunting: Haunting,
  plan: string,
  journal: string
): Promise<void> {
  const prompt = buildResearchPrompt(haunting, plan, journal);

  for await (const message of query({
    prompt,
    options: {
      systemPrompt: RESEARCHER_SYSTEM_PROMPT,
      allowedTools: ["WebSearch", "Bash", "Read", "Write"],
      permissionMode: "bypassPermissions",
      maxTurns: 50,
      cwd: haunting.sourcesDir,
    } satisfies ClaudeAgentOptions,
  })) {
    // The agent searches, fetches, and writes structured JSON files to sources/
    // We let the agent loop run to completion
  }
}
```

**Researcher System Prompt** (src/prompts/researcher.ts):

```
You are Ghost's Research Agent. Your job is to gather information on a specific topic.

You will be given:
- A research objective (what to investigate this cycle)
- Existing knowledge (what's already known, so you don't repeat work)
- Seed search queries (starting points, but generate your own queries too)

Your process:
1. Read the objective and existing knowledge carefully
2. Generate multiple diverse search queries that approach the topic from different angles
3. Execute searches using the WebSearch tool
4. For promising results, fetch the full page content using Bash (curl)
5. Read and extract the most relevant information
6. Save each significant finding as a structured JSON file in the current directory

For each finding, save a JSON file with this structure:
{
    "source_url": "https://...",
    "source_title": "...",
    "source_type": "paper|article|blog|docs|forum|official",
    "fetched_at": "2026-02-16T10:30:00Z",
    "relevance": 0.0-1.0,
    "key_claims": ["claim 1", "claim 2"],
    "entities": ["entity1", "entity2"],
    "raw_excerpt": "The most relevant excerpt from the source (keep under 2000 chars)",
    "summary": "Your 2-3 sentence summary of what this source contributes"
}

Guidelines:
- Be thorough but focused. Follow the plan's objectives.
- Prioritize primary sources (official docs, papers, company blogs) over secondary coverage.
- If you find something that seems very significant or contradicts existing knowledge, note it explicitly.
- Generate at least 3-5 different search queries per objective.
- Fetch and read at least the top 2-3 results for each query.
- Don't re-research things already covered in the existing knowledge.
- Save findings as individual JSON files named src_<short_hash>.json
```

### 4. Observer (src/core/observer.ts)

The Observer processes raw research results into structured observations and updates the journal.

```typescript
import { query, type ClaudeAgentOptions } from "@anthropic-ai/claude-agent-sdk";
import { OBSERVER_SYSTEM_PROMPT } from "../prompts/observer.js";

export async function runObserver(
  haunting: Haunting,
  journal: string,
  reflections: string,
  researchResults: void
): Promise<string> {
  const prompt = `
Process the new research results and update the journal.

Read the following files:
- journal.md (current observations)
- reflections.md (accumulated reflections)
- sources/ directory (new research results from this cycle, JSON files)

Then write the updated journal.md with new observations integrated.
`;

  for await (const message of query({
    prompt,
    options: {
      systemPrompt: OBSERVER_SYSTEM_PROMPT,
      allowedTools: ["Read", "Write", "Glob", "Bash"],
      permissionMode: "bypassPermissions",
      maxTurns: 30,
      cwd: haunting.path,
    } satisfies ClaudeAgentOptions,
  })) {
    // Agent reads files, processes them, writes updated journal.md
  }

  // Agent has written the updated journal.md directly
  return readJournal(haunting);
}
```

**Observer System Prompt** (src/prompts/observer.ts):

```
You are Ghost's Observer Agent. Your role is to process raw research findings and update the research journal with structured observations.

You mimic how a human researcher takes notes: you observe what happened, note what's important, flag what's surprising, and connect new findings to existing knowledge.

You will be given:
- The current journal.md (existing observations)
- The current reflections.md (higher-level patterns, if any)
- Raw research results from the latest cycle (JSON files with findings)

Your task: Produce an UPDATED journal.md that integrates the new findings.

## Observation Format

Each observation follows this format:

```
### [DATE] [TIME] — [Brief title]
**Priority**: 🔴 Critical | 🟡 Notable | ⚪ Incremental
**Source**: [URL or citation]
**Relates to**: [references to other observations or reflections, if any]

[2-4 sentence description of the finding in your own words]

**Key facts**:
- [Specific factual claims extracted from the source]
- [Data points, numbers, dates]

**Implications**: [What this means for the broader research topic]

**Open questions**: [New questions this raises, if any]
```

## Rules

1. **Deduplication**: If a finding is already covered in the journal or reflections, do NOT add it again. Only add genuinely new information.
2. **Contradiction detection**: If a finding contradicts an existing observation, add the new observation AND add a "⚠️ CONTRADICTION" note referencing the conflicting observation.
3. **Corroboration**: If a finding confirms/strengthens an existing observation, you may briefly note this but don't create a full new entry. Instead, add a brief corroboration note to the existing entry.
4. **Priority assignment**:
   - 🔴 Critical: Major new development, significant contradiction, breakthrough finding, or direct answer to a plan objective
   - 🟡 Notable: Interesting finding that adds meaningful new knowledge
   - ⚪ Incremental: Minor update, additional data point, or corroboration
5. **Connections**: Always look for connections between new findings and existing knowledge. Note these explicitly.
6. **Provenance**: Every observation MUST link to its source. Never make claims without attribution.
7. **Timestamps**: Use ISO 8601 timestamps for all entries.
8. **Append, don't rewrite**: Add new observations to the END of the journal. Do not modify existing observations (except to add corroboration notes or contradiction warnings).

## Journal Structure

The journal.md should have this overall structure:

```markdown
# Research Journal: [Haunting Name]

## Summary
[A 3-5 sentence executive summary of the current state of knowledge.
This gets rewritten each cycle to reflect the latest understanding.]

## Observations

[Observations in reverse chronological order — newest first]

### 2026-02-16 14:30 — NVIDIA Isaac Lab releases v2.0
**Priority**: 🔴 Critical
...

### 2026-02-15 10:00 — Survey of physics engines in RL
**Priority**: 🟡 Notable
...
```

Output the complete updated journal.md content.
```

### 5. Reflector (src/core/reflector.ts)

The Reflector compresses older observations into higher-level reflections when the journal gets too long.

**Reflector System Prompt** (src/prompts/reflector.ts):

```
You are Ghost's Reflector Agent. Your role is to compress and synthesize observations from the research journal into higher-level reflections.

This is analogous to how human memory works: you don't remember every detail of every conversation — your brain consolidates experiences into patterns, insights, and durable knowledge.

You will be given:
- The current journal.md (which has grown beyond the token threshold)
- The current reflections.md (existing reflections from previous cycles)

Your task: Produce TWO outputs:

## Output 1: Updated reflections.md

Merge the older observations from the journal into the reflections document. The reflections should:

1. **Synthesize, don't just summarize**: Don't just make observations shorter. Identify patterns, trends, and connections across multiple observations.
2. **Preserve critical details**: Keep specific data points, numbers, dates, and source URLs that are important for the research.
3. **Track evolution**: Note how understanding has evolved (e.g., "Initially believed X, but evidence now points to Y").
4. **Maintain structure**: Organize reflections by theme/subtopic, not chronologically.
5. **Compression ratio**: Aim for 5-10x compression. 30,000 tokens of observations should become ~3,000-6,000 tokens of reflections.

Reflections format:

```markdown
# Reflections: [Haunting Name]

## Last reflected: [timestamp]
## Observation coverage: [date range of observations that have been reflected]

## Theme: [Theme name]

[Dense paragraph synthesizing multiple observations into a coherent understanding.
Include key data points and source references.]

**Key facts**: [Bullet list of the most important specific facts]
**Confidence**: High | Medium | Low
**Sources**: [List of key source URLs]

## Theme: [Another theme]
...

## Unresolved Contradictions
[Any contradictions that haven't been resolved]

## Evolution of Understanding
[How the overall understanding has changed over time]
```

## Output 2: Trimmed journal.md

Remove the observations that have been incorporated into reflections. Keep ONLY:
- Observations from the most recent 2-3 research cycles (they're too fresh to reflect on)
- Any observations marked as 🔴 Critical that haven't been fully incorporated
- The Summary section (update it to reference reflections)

The goal: after reflection, journal.md is small again (under 10,000 tokens), containing only recent observations. All older knowledge lives in reflections.md.

Mark your two outputs clearly:
---REFLECTIONS_START---
[reflections.md content]
---REFLECTIONS_END---

---JOURNAL_START---
[trimmed journal.md content]
---JOURNAL_END---
```

### 6. Planner (src/core/planner.ts)

The Planner generates and updates the research plan based on current knowledge.

**Planner System Prompt** (src/prompts/planner.ts):

```
You are Ghost's Planner Agent. Your role is to maintain and update the research plan based on the current state of knowledge.

You think like a research lead: you look at what's been discovered, identify gaps, prioritize what matters most, and create actionable research objectives.

You will be given:
- The current journal.md (recent observations)
- The current reflections.md (accumulated knowledge)
- The current plan.md (existing plan with completed/in-progress/next items)

Your task: Produce an updated plan.md.

## Planning Rules

1. **Mark completed items**: If the journal/reflections contain sufficient findings for a plan item, mark it as completed with a brief summary of findings and a date.
2. **Update in-progress items**: Note progress on items currently being researched. Add sub-questions that emerged.
3. **Generate new objectives**: Based on the latest observations, what new questions need investigation? What threads should be pulled on? What gaps remain?
4. **Prioritize**: Order "Next" items by importance. Consider:
   - Does this fill a critical knowledge gap?
   - Was this referenced by multiple sources?
   - Does this resolve a contradiction?
   - Is this time-sensitive (fast-moving development)?
5. **Prune stale items**: If a backlog item has been there for many cycles and isn't relevant anymore, remove it.
6. **Stay focused**: Don't let the plan sprawl endlessly. Keep a maximum of 5 items in "Next" and 10 in "Backlog". If you need to add more, remove less important ones.

## Plan Format

```markdown
# Research Plan: [Haunting Name]

## Objective
[The high-level research goal — what is the user trying to understand?]

## Status: Active
## Last updated: [timestamp]
## Cycles completed: [N]

## Completed
- [x] [Item description] — Completed [date]
  - Findings: [1-2 sentence summary, pointer to journal/reflections]

## In Progress
- [ ] [Item description] — Started [date]
  - Progress: [What's been found so far]
  - Sub-questions:
    - [Specific question that emerged]
    - [Another question]

## Next (Priority Order)
1. [ ] [Most important next item]
   - Rationale: [Why this is important now]
2. [ ] [Second priority]
   - Rationale: ...
(max 5 items)

## Backlog
- [ ] [Lower priority item]
- [ ] [Another item]
(max 10 items)

## Research Strategy Notes
[Any meta-observations about the research approach — e.g., "Academic papers
are more reliable than blog posts for benchmark data on this topic" or
"Company X doesn't publish openly, need to triangulate from user reports"]
```

Output the complete updated plan.md content.
```

### 7. Memory Store (src/memory/store.ts)

SQLite database for metadata tracking that supplements the markdown files.

```typescript
import Database from "better-sqlite3";
import path from "node:path";

export function initializeDatabase(ghostHome: string): Database.Database {
  const dbPath = path.join(ghostHome, "ghost.db");
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS hauntings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      last_cycle_at TEXT,
      total_cycles INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      haunting_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      source_type TEXT,
      fetched_at TEXT NOT NULL,
      relevance REAL,
      summary TEXT,
      raw_excerpt TEXT,
      FOREIGN KEY (haunting_id) REFERENCES hauntings(id)
    );

    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      haunting_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      priority TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      source_ids TEXT,
      reflected INTEGER DEFAULT 0,
      FOREIGN KEY (haunting_id) REFERENCES hauntings(id)
    );

    CREATE TABLE IF NOT EXISTS cycle_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      haunting_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      observations_added INTEGER DEFAULT 0,
      sources_fetched INTEGER DEFAULT 0,
      reflected INTEGER DEFAULT 0,
      plan_items_added INTEGER DEFAULT 0,
      notifications_sent INTEGER DEFAULT 0,
      error TEXT,
      FOREIGN KEY (haunting_id) REFERENCES hauntings(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      haunting_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      channel TEXT NOT NULL,
      content TEXT NOT NULL,
      observation_ids TEXT,
      FOREIGN KEY (haunting_id) REFERENCES hauntings(id)
    );
  `);

  return db;
}
```

The SQLite database is supplementary — the markdown files are the source of truth for knowledge. The database tracks metadata, enables querying across hauntings, and provides audit logging.

### 8. Notification System (src/notifications/)

Simple notification dispatch. For MVP, just console output. Designed for easy extension.

```typescript
import type { Haunting } from "../memory/haunting.js";

interface Finding {
  priority: "critical" | "notable" | "incremental";
  title: string;
  summary: string;
  sourceUrl?: string;
}

interface NotificationChannel {
  send(haunting: Haunting, findings: Finding[]): Promise<void>;
}

class ConsoleChannel implements NotificationChannel {
  async send(haunting: Haunting, findings: Finding[]): Promise<void> {
    for (const f of findings) {
      const icon =
        f.priority === "critical" ? "🔴" : f.priority === "notable" ? "🟡" : "⚪";
      console.log(`👻 [${haunting.config.name}] ${icon} ${f.title}`);
      console.log(`   ${f.summary}`);
      if (f.sourceUrl) {
        console.log(`   Source: ${f.sourceUrl}`);
      }
    }
  }
}

export class Notifier {
  private channels: NotificationChannel[];

  constructor(config: { console: boolean }) {
    this.channels = [];
    if (config.console) {
      this.channels.push(new ConsoleChannel());
    }
  }

  async notify(haunting: Haunting, findings: Finding[]): Promise<void> {
    for (const channel of this.channels) {
      await channel.send(haunting, findings);
    }
  }
}
```

---

## Claude Agent SDK Usage Patterns

### How to use the Claude Agent SDK for each agent role

Each agent role (Researcher, Observer, Reflector, Planner) is implemented as a separate `query()` call to the Claude Agent SDK. This keeps each agent focused and avoids context contamination between roles.

```typescript
import { query, type ClaudeAgentOptions } from "@anthropic-ai/claude-agent-sdk";

async function runObserver(haunting: Haunting): Promise<string> {
  // Prepare context: the agent reads files from the haunting directory
  // The Agent SDK works with files, so we leverage the cwd option

  const prompt = `
    Process the new research results and update the journal.
    Read: journal.md, reflections.md, and all JSON files in sources/.
    Then write the updated journal.md with new observations integrated.
  `;

  for await (const message of query({
    prompt,
    options: {
      systemPrompt: OBSERVER_SYSTEM_PROMPT,
      allowedTools: ["Read", "Write", "Glob", "Bash"],
      permissionMode: "bypassPermissions",
      maxTurns: 30,
      cwd: haunting.path,
    },
  })) {
    // The agent reads files, processes them, writes updated journal.md
  }

  // The agent has written the updated journal.md directly
  return readFile(path.join(haunting.path, "journal.md"), "utf-8");
}
```

### Session Management for Chat Mode

For the chat mode (`ghost chat`), use `ClaudeSDKClient` for stateful, multi-turn conversation:

```typescript
import { ClaudeSDKClient } from "@anthropic-ai/claude-agent-sdk";
import * as readline from "node:readline";

async function chatSession(haunting: Haunting): Promise<void> {
  const client = new ClaudeSDKClient({
    options: {
      systemPrompt: buildChatSystemPrompt(haunting),
      allowedTools: ["Read", "Glob", "Bash"],
      permissionMode: "bypassPermissions",
      cwd: haunting.path,
    },
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = (): void => {
    rl.question("You: ", async (input) => {
      if (["exit", "quit", "q"].includes(input.trim().toLowerCase())) {
        rl.close();
        return;
      }

      for await (const message of client.send(input)) {
        // Print assistant responses
        if (message.type === "assistant" && message.content) {
          process.stdout.write(`Ghost: ${message.content}\n`);
        }
      }

      askQuestion();
    });
  };

  askQuestion();
}
```

### Context Management Strategy

The Claude Agent SDK handles context compaction automatically, but we should be strategic about what goes into context:

1. **Reflections first**: Always inject reflections.md before journal.md — reflections are the densest, highest-signal knowledge.
2. **Plan for focus**: Inject plan.md to keep the agent focused on what matters.
3. **Journal for recency**: Journal.md provides recent, detailed observations.
4. **Sources on demand**: Raw sources in sources/ are only read when the agent needs specific details. Don't inject them into context by default.

The agent can always `Read` files to pull in more context as needed. The file-based approach means we leverage the Claude Agent SDK's built-in file tools rather than trying to manage context ourselves.

---

## Implementation Order (MVP Roadmap)

### Phase 1: Foundation (build this first)
1. Project scaffolding (package.json, tsconfig.json, directory structure)
2. Configuration system (config/ — load/validate YAML with Zod)
3. Haunting model (memory/haunting.ts — create, list, read state)
4. Memory file operations (memory/journal.ts, reflections.ts, plan.ts — read/write markdown)
5. SQLite store setup (memory/store.ts — create tables, basic CRUD)

### Phase 2: Core Research Loop
6. Researcher agent (core/researcher.ts — web search + fetch using Agent SDK)
7. Observer agent (core/observer.ts — process results into journal)
8. Planner agent (core/planner.ts — update plan from findings)
9. Cycle orchestration (core/cycle.ts — wire everything together)
10. CLI: `ghost haunt`, `ghost run`, `ghost list`, `ghost status`, `ghost journal`, `ghost plan`

### Phase 3: Intelligence
11. Reflector agent (core/reflector.ts — compress journal into reflections)
12. Notification system (notifications/ — console channel)
13. Chat mode (cli/chat.ts using ClaudeSDKClient)
14. Significance scoring for notifications
15. Snapshot/history system

### Phase 4: Daemon & Scheduling
16. Daemon mode with node-cron
17. Autonomous scheduling (agent decides when to research next)
18. Multiple concurrent hauntings

### Phase 5: Future (not in MVP)
- Sub-agent dispatch for plan objectives
- Vector search over accumulated knowledge
- Web UI (local)
- Additional notification channels (email, Slack, Telegram)
- Cross-haunting knowledge connections
- Export/sharing of research findings

---

## Key Design Decisions

1. **Markdown files as source of truth**: The journal, reflections, and plan are all human-readable markdown files. This means you can always open them directly, version them with git, and understand what Ghost knows. The SQLite database is supplementary metadata.

2. **File-based agent context**: Rather than trying to manage token budgets manually, we leverage the Claude Agent SDK's file tools. The agent reads files it needs, writes updates, and the SDK handles context management. This is simpler and more robust.

3. **Separation of agent roles**: Each agent (Researcher, Observer, Reflector, Planner) runs as a separate `query()` call with its own system prompt. This keeps each agent focused and prevents context contamination. It also means you can swap out or tune individual agents without affecting others.

4. **Observer triggers on research cycles, not token thresholds**: Unlike Mastra's OM which triggers observation when conversation tokens exceed a threshold, Ghost's Observer runs after every research cycle. This is because Ghost's input is research results (discrete batches), not a continuous conversation stream.

5. **Reflector as a compression mechanism**: The Reflector isn't just summarizing — it's synthesizing. It identifies patterns across observations, tracks how understanding evolves, and produces knowledge that's more valuable than the sum of its parts.

6. **Plan as the interface to sub-agents**: The plan.md is designed so that each item can eventually become a task dispatched to a sub-agent. For now the main agent handles everything, but the architecture is ready for sub-agent support.

---

## Error Handling

- If a research cycle fails mid-way, Ghost should save whatever progress was made and log the error. The next cycle can pick up where it left off.
- If the Observer/Reflector/Planner produces malformed output, Ghost should log the error, keep the previous version of the file, and retry on the next cycle.
- All Agent SDK calls should be wrapped in try/catch with proper logging.
- The cycle log in SQLite tracks errors per cycle for debugging.

## Testing Strategy

- Unit tests for file operations (journal parsing, plan parsing, config loading)
- Integration tests for each agent role using mocked Agent SDK responses
- End-to-end test: create a haunting, run one cycle, verify journal/plan are populated
- Test the Reflector with a large journal to verify compression works correctly

---

## Example: Full Cycle Walkthrough

Let's trace through what happens when a user runs `ghost run rl-sim-environments`:

1. **Load state**: Ghost reads `~/.ghost/hauntings/rl-sim-environments/` — loads journal.md (has 5 observations from yesterday), reflections.md (empty, first few cycles), plan.md (has 3 "Next" items).

2. **Research**: The Researcher agent picks the top "Next" plan item: "Investigate NVIDIA Isaac Lab's new RL pipeline." It generates queries like "NVIDIA Isaac Lab RL 2026", "Isaac Lab reinforcement learning features", "Isaac Lab vs MuJoCo comparison." It searches, fetches 8 pages, reads them, and saves 5 JSON files to sources/ with structured findings.

3. **Observe**: The Observer reads the 5 new source files, the existing journal, and produces 3 new observations:
   - 🔴 "Isaac Lab v2.0 released with multi-agent support" (this is significant)
   - 🟡 "Isaac Lab uses GPU-accelerated PhysX 5 backend" (notable detail)
   - ⚪ "Isaac Lab documentation mentions MuJoCo compatibility layer" (incremental)

   It also updates the Summary section of the journal.

4. **Reflect**: Journal is at 8 observations (~12,000 tokens). Below the 30,000 threshold, so no reflection this cycle.

5. **Plan**: The Planner marks "Investigate NVIDIA Isaac Lab's new RL pipeline" as completed. It generates 2 new "Next" items based on findings:
   - "Deep dive into Isaac Lab's multi-agent training capabilities"
   - "Compare PhysX 5 vs MuJoCo physics accuracy for robotic manipulation"

6. **Notify**: The 🔴 observation about Isaac Lab v2.0 exceeds the significance threshold. Ghost prints: `👻 [RL Sim Environments] 🔴 Isaac Lab v2.0 released with multi-agent support`

7. **Snapshot**: Ghost saves timestamped copies of journal.md and plan.md to history/.

Total time: ~2-3 minutes. Total cost: ~$0.30-0.50 in API calls (varies by depth).
