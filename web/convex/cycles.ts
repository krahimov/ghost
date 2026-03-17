import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listForHaunting = query({
  args: { hauntingId: v.id("hauntings") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cycles")
      .withIndex("by_haunting", (q) => q.eq("hauntingId", args.hauntingId))
      .order("desc")
      .collect();
  },
});

export const getCurrent = query({
  args: { hauntingId: v.id("hauntings") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cycles")
      .withIndex("by_haunting", (q) => q.eq("hauntingId", args.hauntingId))
      .order("desc")
      .first();
  },
});

export const start = mutation({
  args: { hauntingId: v.id("hauntings") },
  handler: async (ctx, args) => {
    // Check no cycle is already running for this haunting
    const running = await ctx.db
      .query("cycles")
      .withIndex("by_haunting", (q) => q.eq("hauntingId", args.hauntingId))
      .filter((q) => q.eq(q.field("status"), "running"))
      .first();

    if (running) {
      // If the cycle has been running for more than 30 minutes, it's stuck — fail it
      const age = Date.now() - running.startedAt;
      if (age > 30 * 60 * 1000) {
        await ctx.db.patch(running._id, {
          status: "failed",
          error: "Timed out after 30 minutes",
          completedAt: Date.now(),
        });
      } else {
        throw new Error("A cycle is already running for this haunting");
      }
    }

    // Set haunting status to running
    await ctx.db.patch(args.hauntingId, { status: "running" });

    return await ctx.db.insert("cycles", {
      hauntingId: args.hauntingId,
      status: "running",
      currentPhase: "research",
      phaseNumber: 1,
      observationsAdded: 0,
      sourcesFetched: 0,
      reflected: false,
      planUpdated: false,
      notificationsSent: 0,
      startedAt: Date.now(),
    });
  },
});

// Reset all stuck "running" cycles (for cleanup)
export const resetStuck = mutation({
  args: {},
  handler: async (ctx) => {
    const running = await ctx.db
      .query("cycles")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();

    let reset = 0;
    for (const cycle of running) {
      await ctx.db.patch(cycle._id, {
        status: "failed",
        error: "Reset: cycle was stuck",
        completedAt: Date.now(),
      });
      // Also reset the haunting status
      const haunting = await ctx.db.get(cycle.hauntingId);
      if (haunting && haunting.status === "running") {
        await ctx.db.patch(cycle.hauntingId, { status: "active" });
      }
      reset++;
    }
    return { reset };
  },
});

export const updatePhase = mutation({
  args: {
    id: v.id("cycles"),
    currentPhase: v.string(),
    phaseNumber: v.number(),
    sourcesFetched: v.optional(v.number()),
    observationsAdded: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, any> = {
      currentPhase: args.currentPhase,
      phaseNumber: args.phaseNumber,
    };
    if (args.sourcesFetched !== undefined)
      patch.sourcesFetched = args.sourcesFetched;
    if (args.observationsAdded !== undefined)
      patch.observationsAdded = args.observationsAdded;

    await ctx.db.patch(args.id, patch);
  },
});

export const complete = mutation({
  args: {
    id: v.id("cycles"),
    hauntingId: v.id("hauntings"),
    observationsAdded: v.number(),
    sourcesFetched: v.number(),
    reflected: v.boolean(),
    planUpdated: v.boolean(),
    notificationsSent: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const status = args.error ? "failed" : "completed";

    await ctx.db.patch(args.id, {
      status,
      observationsAdded: args.observationsAdded,
      sourcesFetched: args.sourcesFetched,
      reflected: args.reflected,
      planUpdated: args.planUpdated,
      notificationsSent: args.notificationsSent,
      error: args.error,
      completedAt: Date.now(),
    });

    // Reset haunting status
    const haunting = await ctx.db.get(args.hauntingId);
    if (haunting) {
      await ctx.db.patch(args.hauntingId, {
        status: haunting.status === "running" ? "active" : haunting.status,
        totalCycles: haunting.totalCycles + (args.error ? 0 : 1),
        lastCycleAt: Date.now(),
      });
    }
  },
});
