import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Helper to normalize paths
const normalizePath = (path: string) => path.replace(/^\/+/, '');

// FILE OPERATIONS

export const save = mutation({
  args: { 
    projectId: v.id("projects"),
    path: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // ... existing save handler
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");
    if (project.userId !== identity.tokenIdentifier) throw new Error("Unauthorized");
    
    const cleanPath = normalizePath(args.path);

    const existing = await ctx.db
        .query("files")
        .withIndex("by_projectId_path", (q) => 
            q.eq("projectId", args.projectId).eq("path", cleanPath)
        )
        .first();

    if (existing) {
        await ctx.db.patch(existing._id, { content: args.content });
    } else {
        await ctx.db.insert("files", {
            projectId: args.projectId,
            path: cleanPath,
            content: args.content,
        });
    }
  },
});

// Internal mutation for agent (bypasses auth)
export const saveInternal = internalMutation({
  args: { 
    projectId: v.id("projects"),
    path: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanPath = normalizePath(args.path);
    const existing = await ctx.db
        .query("files")
        .withIndex("by_projectId_path", (q) => 
            q.eq("projectId", args.projectId).eq("path", cleanPath)
        )
        .first();

    if (existing) {
        await ctx.db.patch(existing._id, { content: args.content });
    } else {
        await ctx.db.insert("files", {
            projectId: args.projectId,
            path: cleanPath,
            content: args.content,
        });
    }
  },
});

export const read = query({
  args: { projectId: v.id("projects"), path: v.string() },
  handler: async (ctx, args) => {
      const cleanPath = normalizePath(args.path);
      const file = await ctx.db
          .query("files")
          .withIndex("by_projectId_path", (q) => 
              q.eq("projectId", args.projectId).eq("path", cleanPath)
          )
          .first();
      return file ? file.content : null;
  },
});

// Internal query for agent (bypasses auth)
export const readInternal = internalQuery({
  args: { projectId: v.id("projects"), path: v.string() },
  handler: async (ctx, args) => {
      const cleanPath = normalizePath(args.path);
      const file = await ctx.db
          .query("files")
          .withIndex("by_projectId_path", (q) => 
              q.eq("projectId", args.projectId).eq("path", cleanPath)
          )
          .first();
      return file ? file.content : null;
  },
});

export const getFiles = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        // TODO: Auth check needed here in prod
        return await ctx.db
            .query("files")
            .withIndex("by_projectId", q => q.eq("projectId", args.projectId))
            .collect();
    }
})

// Internal query for agent (bypasses auth)
export const getFilesInternal = internalQuery({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("files")
            .withIndex("by_projectId", q => q.eq("projectId", args.projectId))
            .collect();
    }
})

// TEMPLATE OPERATIONS
export const saveSystemTemplate = mutation({
    args: {
        projectId: v.id("projects"),
        path: v.string(),
        content: v.string()
    },
    handler: async (ctx, args) => {
        const cleanPath = normalizePath(args.path);
        const existing = await ctx.db
        .query("files")
        .withIndex("by_projectId_path", (q) => 
            q.eq("projectId", args.projectId).eq("path", cleanPath)
        )
        .first();

        if (existing) {
            await ctx.db.patch(existing._id, { content: args.content });
        } else {
            await ctx.db.insert("files", {
                projectId: args.projectId,
                path: cleanPath,
                content: args.content,
            });
        }
    }
});

export const deleteFile = mutation({
    args: {
        projectId: v.id("projects"),
        path: v.string()
    },
    handler: async (ctx, args) => {
        const cleanPath = normalizePath(args.path);
        const existing = await ctx.db
            .query("files")
            .withIndex("by_projectId_path", (q) => 
                q.eq("projectId", args.projectId).eq("path", cleanPath)
            )
            .first();
        if (existing) {
            await ctx.db.delete(existing._id);
        }
    }
});

// Internal mutation for agent (bypasses auth)
export const deleteFileInternal = internalMutation({
    args: {
        projectId: v.id("projects"),
        path: v.string()
    },
    handler: async (ctx, args) => {
        const cleanPath = normalizePath(args.path);
        const existing = await ctx.db
            .query("files")
            .withIndex("by_projectId_path", (q) => 
                q.eq("projectId", args.projectId).eq("path", cleanPath)
            )
            .first();
        if (existing) {
            await ctx.db.delete(existing._id);
        }
    }
});

export const getSystemProject = query({
    args: { title: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("projects")
            .filter(q => q.eq(q.field("title"), args.title))
            .first();
    }
});
