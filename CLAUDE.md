# Ghost — Autonomous Research Agent

## What is Ghost?

Ghost is an always-on research agent that continuously investigates topics ("hauntings"), builds a compounding knowledge base over days/weeks, and proactively notifies you of significant findings. It's a replacement/upgrade to one-shot deep research tools.

## Tech Stack

- **Runtime**: Node.js 20+ / TypeScript 5+
- **Agent framework**: Claude Agent SDK (TypeScript) — `@anthropic-ai/claude-agent-sdk`
- **Storage**: better-sqlite3 for metadata + optional vector embeddings
- **Scheduling**: node-cron for daemon mode
- **CLI**: Commander + Inquirer for interactive setup
- **Notifications**: Console initially. Later: email, Slack, Telegram

## Architecture

Read `docs/architecture.md` for the full system design, component specs, agent prompts, data schemas, and implementation roadmap. **Always read it before starting a new phase of work.**

## Key Principles

1. **Markdown files are the source of truth** for knowledge. journal.md, reflections.md, and plan.md are human-readable, git-versionable research artifacts. SQLite is supplementary metadata.
2. **Separation of agent roles**: Researcher, Observer, Reflector, and Planner each run as separate `query()` calls with their own system prompts. Never combine them.
3. **File-based agent context**: Agents read/write files in the haunting directory. The SDK handles context management. Don't try to manage token budgets manually.
4. **Observer triggers per research cycle**, not per token threshold (unlike Mastra's OM which triggers on conversation length).

## Project Structure

```
ghost/
├── CLAUDE.md                    # This file
├── docs/
│   └── architecture.md          # Full spec — READ THIS FIRST
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # CLI entrypoint
│   ├── cli/                     # CLI commands (commander)
│   ├── config/                  # Config loading/validation
│   ├── core/                    # Core agents and orchestration
│   │   ├── cycle.ts             # Research cycle orchestration
│   │   ├── researcher.ts        # Research execution
│   │   ├── observer.ts          # Observer agent (Tier 2)
│   │   ├── reflector.ts         # Reflector agent (Tier 3)
│   │   └── planner.ts           # Planner agent
│   ├── memory/                  # File and DB operations
│   ├── notifications/           # Notification dispatch
│   └── prompts/                 # System prompts for each agent role
├── tests/
└── data/                        # Default data directory
```

## Implementation Phases

- **Phase 1**: Foundation — scaffolding, config, haunting model, memory file ops, SQLite
- **Phase 2**: Core loop — researcher, observer, planner, cycle orchestration, CLI commands
- **Phase 3**: Intelligence — reflector, notifications, chat mode, significance scoring
- **Phase 4**: Daemon — scheduling, autonomous timing, concurrent hauntings
- **Phase 5**: Future — sub-agents, vector search, web UI, cross-haunting connections

## Conventions

- Use ES modules (`"type": "module"` in package.json)
- Use Zod for config/schema validation
- Use `tsx` for development, `tsup` for building
- Prefer async/await with proper error handling everywhere
- All Agent SDK calls must be wrapped in try/catch with logging
- Write tests with Vitest
