import type { GlobalConfig, HauntingConfig } from "./schema.js";

export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  ghost: {
    home: "~/.ghost",
    default_model: "claude-sonnet-4-5-20250929",
    log_level: "info",
  },
  notifications: {
    enabled: false,
    channels: {
      console: { enabled: true },
    },
  },
  defaults: {
    schedule: "daily",
    observer: { priority_threshold: 0.6 },
    reflector: { journal_token_threshold: 30000 },
    planner: { max_next_items: 5 },
  },
};

export function createDefaultHauntingConfig(
  name: string,
  description: string,
  searchQueries: string[] = [],
): HauntingConfig {
  return {
    name,
    description,
    created: new Date().toISOString(),
    status: "active",
    schedule: {
      mode: "fixed",
      interval: "daily",
    },
    research: {
      depth: "standard",
      max_sources_per_cycle: 10,
      search_queries_base: searchQueries,
    },
  };
}
