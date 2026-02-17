# Ghost

Autonomous, always-on research agent that compounds knowledge over time. Unlike one-shot research tools, Ghost continuously investigates topics over days and weeks, building a layered knowledge base with observations, reflections, and strategic insights.

Built on the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk).

## How It Works

Ghost runs **persistent research missions** called **hauntings**. Each haunting follows a research cycle:

1. **Research** — Searches the web and fetches sources using Claude Agent SDK
2. **Observe** — Processes raw sources into prioritized observations (journal.md)
3. **Reflect** — Compresses older observations into high-level insights (reflections.md)
4. **Plan** — Updates the research plan based on what's been learned (plan.md)
5. **Notify** — Alerts you when critical findings are detected

Each agent role (Researcher, Observer, Reflector, Planner) runs as a separate `query()` call with its own system prompt and tools. The three-tier memory system is inspired by [Mastra AI's Observational Memory](https://mastra.ai/docs/memory/observational-memory):

```
Raw Sources (Tier 1) → Observations (Tier 2) → Reflections (Tier 3)
```

## Quick Start

### Prerequisites

- Node.js 20+
- An Anthropic API key (set `ANTHROPIC_API_KEY` environment variable)

### Install

```bash
git clone <repo-url>
cd ghost
npm install
npm run build
npm link
```

### Initialize

```bash
ghost init
```

This creates `~/.ghost/` with a config file and database. You'll be prompted to set up a **researcher context** — this tells Ghost who you are, what you're building, and what kind of research matters to you.

### Create a Haunting

```bash
ghost haunt "AI Agent Frameworks"
```

Interactive prompts will ask for:
- **Description** — What you want to learn about this topic
- **Depth** — shallow (5 sources), standard (10), or deep (15) per cycle
- **Schedule** — hourly, daily, or weekly
- **Context** — Use existing, create new per-project context, or skip

Ghost auto-generates seed search queries and a purpose.md connecting the topic to your strategic context.

To run the first cycle immediately:

```bash
ghost haunt "AI Agent Frameworks" --run
```

### Run a Cycle

```bash
ghost run ai-agent-frameworks
```

A cycle typically takes 10-20 minutes depending on depth and model. You'll see a report with observations, sources collected, and notifications.

### Chat with Your Research

```bash
ghost chat ai-agent-frameworks
```

Interactive Q&A with all accumulated knowledge — journal, reflections, source details, and research plan. Answers are grounded in your collected sources with citations.

## Commands

| Command | Description |
|---------|-------------|
| `ghost init` | Initialize Ghost and set up researcher context |
| `ghost haunt <topic>` | Create a new research mission |
| `ghost run [slug]` | Run a research cycle (`--all` for all hauntings) |
| `ghost list` | List all hauntings with status |
| `ghost status <slug>` | Detailed status of a haunting |
| `ghost chat <slug>` | Chat with accumulated knowledge |
| `ghost journal <slug>` | View the research journal (`--tail <n>`) |
| `ghost plan <slug>` | View the current research plan |
| `ghost report <slug>` | View reports (`--latest`, `--list`) |
| `ghost peek <slug>` | Check on a running cycle |
| `ghost context` | View/edit researcher context (`--edit`, `--haunting <slug>`) |
| `ghost pause <slug>` | Pause a haunting |
| `ghost resume <slug>` | Resume a paused haunting |
| `ghost delete <slug>` | Delete a haunting and all its data |
| `ghost daemon` | Start scheduler in foreground |
| `ghost daemon start` | Start daemon in background |
| `ghost daemon stop` | Stop the background daemon |
| `ghost daemon status` | Check daemon status |

## Daemon Mode

Ghost can run autonomously on a schedule:

```bash
ghost daemon start
```

The daemon checks every 60 seconds for hauntings that are due based on their schedule (hourly, daily, weekly). It manages cycle locks to prevent overlapping runs and logs activity to `~/.ghost/daemon.log`.

```bash
ghost daemon status   # Check what's running and next scheduled times
ghost daemon stop     # Stop the daemon
```

## Researcher Context

Ghost uses two levels of context to personalize research:

- **Global context** (`~/.ghost/context.md`) — Who you are, what you're building, your strategic position
- **Per-haunting context** (`<haunting>/context.md`) — Project-specific identity, overrides global

Each haunting also gets a **purpose.md** — an AI-generated document that connects the research topic to your strategic needs, guiding agents on what findings are most valuable.

```bash
ghost context                        # View global context
ghost context --edit                 # Re-run context setup
ghost context --haunting my-topic    # View per-haunting context
```

## Data Structure

```
~/.ghost/
├── config.yaml                    # Global configuration
├── context.md                     # Global researcher context
├── ghost.db                       # SQLite (metadata + sources)
└── hauntings/
    └── ai-agent-frameworks/
        ├── config.yaml            # Haunting config
        ├── context.md             # Per-project context
        ├── purpose.md             # Why this research matters
        ├── journal.md             # Observations (Tier 2)
        ├── reflections.md         # Compressed insights (Tier 3)
        ├── plan.md                # Research plan
        ├── reports/               # Saved cycle reports
        └── sources/               # Cached raw sources
```

Markdown files are the source of truth for knowledge. They're human-readable and git-versionable. SQLite stores metadata and persisted source data for chat retrieval.

## Configuration

Global config lives at `~/.ghost/config.yaml`:

```yaml
ghost:
  home: ~/.ghost
  default_model: claude-opus-4-6
  log_level: info

notifications:
  enabled: false
  channels:
    console:
      enabled: true

defaults:
  schedule: daily
  observer:
    priority_threshold: 0.6
  reflector:
    journal_token_threshold: 30000
  planner:
    max_next_items: 5
```

Per-haunting config overrides are set in each haunting's `config.yaml`.

## Tech Stack

- **Runtime**: Node.js 20+ / TypeScript 5
- **Agent Framework**: [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk)
- **LLM**: Claude Opus 4.6 (research + observation), Claude Sonnet 4.5 (planning)
- **Storage**: better-sqlite3 for metadata and source persistence
- **Scheduling**: node-cron for daemon mode
- **CLI**: Commander + Inquirer
- **Build**: tsup (ESM)
- **Tests**: Vitest

## Development

```bash
npm run dev -- <command>    # Run in dev mode with tsx
npm run build               # Build with tsup
npm test                    # Run tests
npm run lint                # Type-check
```

## License

MIT
