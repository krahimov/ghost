import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listForHaunting = query({
  args: { hauntingId: v.id("hauntings") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_haunting", (q) => q.eq("hauntingId", args.hauntingId))
      .order("asc")
      .collect();
  },
});

export const send = mutation({
  args: {
    hauntingId: v.id("hauntings"),
    role: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    return await ctx.db.insert("chatMessages", {
      hauntingId: args.hauntingId,
      userId: user._id,
      role: args.role,
      content: args.content,
      createdAt: Date.now(),
    });
  },
});

export const clearHistory = mutation({
  args: { hauntingId: v.id("hauntings") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_haunting", (q) => q.eq("hauntingId", args.hauntingId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
  },
});
