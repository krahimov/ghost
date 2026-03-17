import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listForHaunting = query({
  args: {
    hauntingId: v.id("hauntings"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("sources")
      .withIndex("by_haunting", (q) => q.eq("hauntingId", args.hauntingId))
      .order("desc")
      .take(args.limit ?? 100);
    return results;
  },
});

export const search = query({
  args: {
    hauntingId: v.id("hauntings"),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sources")
      .withSearchIndex("search_sources", (q) =>
        q.search("summary", args.query).eq("hauntingId", args.hauntingId),
      )
      .take(20);
  },
});

export const count = query({
  args: { hauntingId: v.id("hauntings") },
  handler: async (ctx, args) => {
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_haunting", (q) => q.eq("hauntingId", args.hauntingId))
      .collect();
    return sources.length;
  },
});

export const insert = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sources", args);
  },
});
