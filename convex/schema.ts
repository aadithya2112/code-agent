import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projects: defineTable({
    userId: v.string(),     // Clerk User ID
    title: v.string(),      // Project title
    createdAt: v.number(),  // Timestamp
  })
  .index("by_userId", ["userId"]),
  
  messages: defineTable({
    projectId: v.id("projects"),  
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    userId: v.string(),     
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
