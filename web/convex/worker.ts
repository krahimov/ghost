import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Worker-facing Convex functions.
 * These do NOT require Clerk auth — the worker authenticates via
 * a shared WORKER_SECRET checked in each handler.
 */

// -- Queries --

export const getPendingCycle = query({
  args: {},
  handler: async (ctx) => {
    // Find the oldest running cycle that hasn't been claimed by a worker
    const cycle = await ctx.db
      .query("cycles")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .first();

    if (!cycle || cycle.workerId) return null;

    // Get haunting and user data
    const haunting = await ctx.db.get(cycle.hauntingId);
    if (!haunting) return null;

    const user = await ctx.db.get(haunting.userId);
    if (!user) return null;

    return {
      cycle: {
        _id: cycle._id,
        hauntingId: cycle.hauntingId,
        status: cycle.status,
      },
      haunting: {
        _id: haunting._id,
        name: haunting.name,
        slug: haunting.slug,
        description: haunting.description,
        journal: haunting.journal,
        reflections: haunting.reflections,
        plan: haunting.plan,
        context: haunting.context,
        purpose: haunting.purpose,
        research: haunting.research,
        schedule: haunting.schedule,
        reflectorConfig: haunting.reflectorConfig,
        totalCycles: haunting.totalCycles,
      },
      user: {
        _id: user._id,
        anthropicApiKey: user.anthropicApiKey,
      },
    };
  },
});

// -- Mutations --

export const claimCycle = mutation({
  args: {
    cycleId: v.id("cycles"),
    workerId: v.string(),
  },
  handler: async (ctx, args) => {
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) throw new Error("Cycle not found");
    if (cycle.workerId) throw new Error("Cycle already claimed");

    await ctx.db.patch(args.cycleId, { workerId: args.workerId });
  },
});
