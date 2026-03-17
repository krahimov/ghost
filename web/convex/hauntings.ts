import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Helper to get current authenticated user
async function getCurrentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
    .first();
  if (!user) throw new Error("User not found");
  return user;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    return await ctx.db
      .query("hauntings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return null;

    return await ctx.db
      .query("hauntings")
      .withIndex("by_user_slug", (q) =>
        q.eq("userId", user._id).eq("slug", args.slug),
      )
      .first();
  },
});

export const getById = query({
  args: { id: v.id("hauntings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    depth: v.string(),
    interval: v.string(),
    searchQueries: v.array(v.string()),
    context: v.optional(v.string()),
    purpose: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const slug = slugify(args.name);

    // Check for duplicate slug
    const existing = await ctx.db
      .query("hauntings")
      .withIndex("by_user_slug", (q) =>
        q.eq("userId", user._id).eq("slug", slug),
      )
      .first();
    if (existing) throw new Error("A haunting with this name already exists");

    const maxSources =
      args.depth === "deep" ? 15 : args.depth === "shallow" ? 5 : 10;

    const journal = `# Research Journal: ${args.name}\n\n## Summary\nResearch has not yet begun.\n\n## Observations\n\n`;
    const reflections = `# Reflections: ${args.name}\n\nNo reflections yet.\n`;
    const plan = `# Research Plan: ${args.name}\n\n## Objective\n${args.description}\n\n## Status: Active\n## Last updated: ${new Date().toISOString().slice(0, 10)}\n## Cycles completed: 0\n\n## Completed\n\n## In Progress\n\n## Next (Priority Order)\n1. [ ] Initial broad survey of ${args.name}\n   - Rationale: Establish baseline understanding\n\n## Backlog\n`;

    return await ctx.db.insert("hauntings", {
      userId: user._id,
      name: args.name,
      slug,
      description: args.description,
      status: "active",
      schedule: {
        mode: "fixed",
        interval: args.interval,
      },
      research: {
        depth: args.depth,
        maxSourcesPerCycle: maxSources,
        searchQueriesBase: args.searchQueries,
      },
      context: args.context || user.globalContext,
      purpose: args.purpose,
      journal,
      reflections,
      plan,
      totalCycles: 0,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("hauntings"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    depth: v.optional(v.string()),
    interval: v.optional(v.string()),
    context: v.optional(v.string()),
    purpose: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const haunting = await ctx.db.get(id);
    if (!haunting) throw new Error("Haunting not found");

    const patch: Record<string, any> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.description !== undefined)
      patch.description = updates.description;
    if (updates.context !== undefined) patch.context = updates.context;
    if (updates.purpose !== undefined) patch.purpose = updates.purpose;
    if (updates.depth !== undefined) {
      patch.research = {
        ...haunting.research,
        depth: updates.depth,
        maxSourcesPerCycle:
          updates.depth === "deep"
            ? 15
            : updates.depth === "shallow"
              ? 5
              : 10,
      };
    }
    if (updates.interval !== undefined) {
      patch.schedule = { ...haunting.schedule, interval: updates.interval };
    }

    await ctx.db.patch(id, patch);
  },
});

export const pause = mutation({
  args: { id: v.id("hauntings") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "paused" });
  },
});

export const resume = mutation({
  args: { id: v.id("hauntings") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "active" });
  },
});

export const remove = mutation({
  args: { id: v.id("hauntings") },
  handler: async (ctx, args) => {
    // Delete related records
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_haunting", (q) => q.eq("hauntingId", args.id))
      .collect();
    for (const source of sources) {
      await ctx.db.delete(source._id);
    }

    const cycles = await ctx.db
      .query("cycles")
      .withIndex("by_haunting", (q) => q.eq("hauntingId", args.id))
      .collect();
    for (const cycle of cycles) {
      await ctx.db.delete(cycle._id);
    }

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_haunting", (q) => q.eq("hauntingId", args.id))
      .collect();
    for (const notification of notifications) {
      await ctx.db.delete(notification._id);
    }

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_haunting", (q) => q.eq("hauntingId", args.id))
      .collect();
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    await ctx.db.delete(args.id);
  },
});

// Internal mutation for worker to update haunting data after cycle phases
export const updateFromCycle = mutation({
  args: {
    id: v.id("hauntings"),
    journal: v.optional(v.string()),
    reflections: v.optional(v.string()),
    plan: v.optional(v.string()),
    status: v.optional(v.string()),
    totalCycles: v.optional(v.number()),
    lastCycleAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const patch: Record<string, any> = {};
    if (updates.journal !== undefined) patch.journal = updates.journal;
    if (updates.reflections !== undefined)
      patch.reflections = updates.reflections;
    if (updates.plan !== undefined) patch.plan = updates.plan;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.totalCycles !== undefined)
      patch.totalCycles = updates.totalCycles;
    if (updates.lastCycleAt !== undefined)
      patch.lastCycleAt = updates.lastCycleAt;

    await ctx.db.patch(id, patch);
  },
});
