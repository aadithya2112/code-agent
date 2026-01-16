import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projects: defineTable({
    userId: v.string(),     // Clerk User ID
    title: v.string(),      // Project title
    createdAt: v.number(),  // Timestamp
    projectType: v.optional(v.union(v.literal("react"), v.literal("nextjs"))), // Project framework type
    needsSandboxRestart: v.optional(v.boolean()), // Signal to frontend that sandbox needs restart
  })
  .index("by_userId", ["userId"]),
  
  messages: defineTable({
    projectId: v.id("projects"),  
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    userId: v.string(),
    toolCall: v.optional(v.object({
        name: v.string(),
        args: v.any(),
        result: v.optional(v.string())
    })),
  })
  .index("by_projectId", ["projectId"]),

  files: defineTable({
    projectId: v.id("projects"),
    path: v.string(),
    content: v.string(),
    // embedding: v.array(v.float64()), // Future RAG
  })
  .index("by_projectId_path", ["projectId", "path"])
  .index("by_projectId", ["projectId"]),
});
