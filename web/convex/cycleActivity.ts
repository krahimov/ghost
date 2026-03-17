import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listForCycle = query({
  args: { cycleId: v.id("cycles") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cycleActivity")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();
  },
});

export const insert = mutation({
  args: {
    cycleId: v.id("cycles"),
    hauntingId: v.id("hauntings"),
    phase: v.string(),
    type: v.string(),
    title: v.string(),
    detail: v.optional(v.string()),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("cycleActivity", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const clearForCycle = mutation({
  args: { cycleId: v.id("cycles") },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("cycleActivity")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();
    for (const event of events) {
      await ctx.db.delete(event._id);
    }
  },
});
