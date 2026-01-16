import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const send = mutation({
  args: { 
    projectId: v.id("projects"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.tokenIdentifier) {
        throw new Error("Unauthorized");
    }

    return await ctx.db.insert("messages", {
        projectId: args.projectId,
        role: args.role,
        content: args.content,
        userId: identity.tokenIdentifier,
    });
  },
});

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.tokenIdentifier) {
        return [];
    }
    
    return await ctx.db
      .query("messages")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});
