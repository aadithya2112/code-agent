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
    userId: v.string(),     // Redundant but useful for security/access patterns
  })
  .index("by_projectId", ["projectId"]),
});
