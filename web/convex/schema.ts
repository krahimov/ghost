import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // --- Users (synced from Clerk via webhook) ---
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    anthropicApiKey: v.optional(v.string()),
    globalContext: v.optional(v.string()),
    notificationPrefs: v.optional(
      v.object({
        web: v.boolean(),
        email: v.optional(v.boolean()),
        phone: v.optional(v.string()),
      }),
    ),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  // --- Hauntings (research missions) ---
  hauntings: defineTable({
    userId: v.id("users"),
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    status: v.string(), // "active" | "paused" | "completed" | "running"
    schedule: v.object({
      mode: v.string(), // "fixed" | "autonomous"
      interval: v.string(), // "hourly" | "daily" | "weekly"
      cron: v.optional(v.string()),
    }),
    research: v.object({
      depth: v.string(), // "shallow" | "standard" | "deep"
      maxSourcesPerCycle: v.number(),
      searchQueriesBase: v.array(v.string()),
    }),
    observerConfig: v.optional(
      v.object({
        priorityThreshold: v.number(),
      }),
    ),
    reflectorConfig: v.optional(
      v.object({
        journalTokenThreshold: v.number(),
      }),
    ),
    context: v.optional(v.string()),
    purpose: v.optional(v.string()),
    journal: v.string(),
    reflections: v.string(),
    plan: v.string(),
    totalCycles: v.number(),
    lastCycleAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_slug", ["userId", "slug"]),

  // --- Sources (research artifacts) ---
  sources: defineTable({
    hauntingId: v.id("hauntings"),
    cycleId: v.optional(v.id("cycles")),
    url: v.string(),
    title: v.string(),
    sourceType: v.optional(v.string()),
    fetchedAt: v.number(),
    relevance: v.optional(v.number()),
    summary: v.optional(v.string()),
    rawExcerpt: v.optional(v.string()),
    keyClaims: v.optional(v.array(v.string())),
    entities: v.optional(v.array(v.string())),
    strategicRelevance: v.optional(v.string()),
  })
    .index("by_haunting", ["hauntingId"])
    .searchIndex("search_sources", {
      searchField: "summary",
      filterFields: ["hauntingId"],
    }),

  // --- Cycles (execution log with real-time phase tracking) ---
  cycles: defineTable({
    hauntingId: v.id("hauntings"),
    status: v.string(), // "running" | "completed" | "failed"
    currentPhase: v.optional(v.string()), // "research" | "observe" | "reflect" | "plan" | "notify"
    phaseNumber: v.optional(v.number()),
    observationsAdded: v.number(),
    sourcesFetched: v.number(),
    reflected: v.boolean(),
    planUpdated: v.boolean(),
    notificationsSent: v.number(),
    error: v.optional(v.string()),
    workerId: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_haunting", ["hauntingId"])
    .index("by_status", ["status"]),

  // --- Notifications ---
  notifications: defineTable({
    userId: v.id("users"),
    hauntingId: v.id("hauntings"),
    cycleId: v.optional(v.id("cycles")),
    type: v.string(), // "finding" | "cycle_complete" | "error"
    priority: v.string(), // "critical" | "notable" | "incremental"
    title: v.string(),
    summary: v.string(),
    sourceUrl: v.optional(v.string()),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "read"])
    .index("by_haunting", ["hauntingId"]),

  // --- Cycle activity (real-time agent event stream) ---
  cycleActivity: defineTable({
    cycleId: v.id("cycles"),
    hauntingId: v.id("hauntings"),
    phase: v.string(), // "research" | "observe" | "reflect" | "plan" | "notify"
    type: v.string(), // "search" | "fetch" | "source_saved" | "observation" | "info" | "error"
    title: v.string(),
    detail: v.optional(v.string()),
    url: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_cycle", ["cycleId"]),

  // --- Chat messages ---
  chatMessages: defineTable({
    hauntingId: v.id("hauntings"),
    userId: v.id("users"),
    role: v.string(), // "user" | "assistant"
    content: v.string(),
    createdAt: v.number(),
  }).index("by_haunting", ["hauntingId"]),
});
