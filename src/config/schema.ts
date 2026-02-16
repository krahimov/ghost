import { z } from "zod";

export const NotificationChannelSchema = z.object({
  enabled: z.boolean().default(false),
});

export const GlobalConfigSchema = z.object({
  ghost: z
    .object({
      home: z.string().default("~/.ghost"),
      default_model: z.string().default("claude-sonnet-4-5-20250929"),
      log_level: z.enum(["debug", "info", "warn", "error"]).default("info"),
    })
    .default({
      home: "~/.ghost",
      default_model: "claude-sonnet-4-5-20250929",
      log_level: "info",
    }),
  notifications: z
    .object({
      enabled: z.boolean().default(false),
      channels: z
        .object({
          console: NotificationChannelSchema.default({ enabled: true }),
        })
        .default({ console: { enabled: true } }),
    })
    .default({
      enabled: false,
      channels: { console: { enabled: true } },
    }),
  defaults: z
    .object({
      schedule: z.string().default("daily"),
      observer: z
        .object({
          priority_threshold: z.number().default(0.6),
        })
        .default({ priority_threshold: 0.6 }),
      reflector: z
        .object({
          journal_token_threshold: z.number().default(30000),
        })
        .default({ journal_token_threshold: 30000 }),
      planner: z
        .object({
          max_next_items: z.number().default(5),
        })
        .default({ max_next_items: 5 }),
    })
    .default({
      schedule: "daily",
      observer: { priority_threshold: 0.6 },
      reflector: { journal_token_threshold: 30000 },
      planner: { max_next_items: 5 },
    }),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;

export const HauntingConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  created: z.string(),
  status: z.enum(["active", "paused", "completed"]).default("active"),
  schedule: z
    .object({
      mode: z.enum(["fixed", "autonomous"]).default("fixed"),
      interval: z.enum(["hourly", "daily", "weekly"]).default("daily"),
      cron: z.string().optional(),
    })
    .default({ mode: "fixed", interval: "daily" }),
  research: z
    .object({
      depth: z.enum(["shallow", "standard", "deep"]).default("standard"),
      max_sources_per_cycle: z.number().default(10),
      search_queries_base: z.array(z.string()).default([]),
    })
    .default({
      depth: "standard",
      max_sources_per_cycle: 10,
      search_queries_base: [],
    }),
  observer: z
    .object({
      priority_threshold: z.number().default(0.5),
    })
    .optional(),
  reflector: z
    .object({
      journal_token_threshold: z.number().default(25000),
    })
    .optional(),
});

export type HauntingConfig = z.infer<typeof HauntingConfigSchema>;
