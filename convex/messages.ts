import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
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

    await ctx.db.insert("messages", {
        projectId: args.projectId,
        role: args.role,
        content: args.content,
        userId: identity.tokenIdentifier,
    });

    if (args.role === "user") {
        await ctx.scheduler.runAfter(0, (internal as any).agent.chat, {
            projectId: args.projectId,
            userId: identity.tokenIdentifier,
            latestUserMessage: args.content, // Pass the message that just triggered this
        });
    }
  },
});

// Internal mutation for agent to save messages (bypasses auth checks)
export const sendInternal = internalMutation({
  args: { 
    projectId: v.id("projects"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    userId: v.string(),
    toolCall: v.optional(v.object({
        name: v.string(),
        args: v.any(),
        result: v.optional(v.string())
    })),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
        projectId: args.projectId,
        role: args.role,
        content: args.content,
        userId: args.userId,
        toolCall: args.toolCall,
    });
  },
});

export const updateInternal = internalMutation({
    args: {
        messageId: v.id("messages"),
        toolCall: v.object({
            name: v.string(),
            args: v.any(),
            result: v.optional(v.string())
        })
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.messageId, {
            toolCall: args.toolCall
        });
    }
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
