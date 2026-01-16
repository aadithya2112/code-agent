"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import Sandbox from "@e2b/code-interpreter";

export const saveAndSync = action({
  args: {
    projectId: v.id("projects"),
    path: v.string(),
    content: v.string(),
    sandboxID: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Save to Database (Source of Truth)
    await ctx.runMutation(internal.files.saveInternal, {
        projectId: args.projectId,
        path: args.path,
        content: args.content,
    });

    // 2. Sync to E2B Sandbox (Live Environment)
    if (args.sandboxID) {
        try {
            // Connect to existing sandbox
            const sandbox = await Sandbox.connect(args.sandboxID, {
                apiKey: process.env.E2B_API_KEY,
            });

            // Write file directly to sandbox filesystem
            // Note: writing to the root often requires matching the structure.
            // In the agent, paths are usually relative.
            await (sandbox as any).filesystem.write(args.path, args.content);
            
            console.log(`Synced ${args.path} to sandbox ${args.sandboxID}`);
            
            // Cleanup connection? Sandbox.connect returns a live connection.
            // Usually we kill it if we created it, but here we just want to drop the connection object
            // without killing the actual sandbox process since the user is using it.
            // There isn't an explicit "disconnect" method in the basic docs, it just goes out of scope.
            // If we call .kill(), it destroys the remote sandbox. WE DO NOT WANT THAT.
            
        } catch (error) {
            console.error("Failed to sync to sandbox:", error);
            // We don't throw here because the DB save was successful, 
            // and we don't want to break the UI. But we should warn.
            return { success: true, synced: false, error: String(error) };
        }
    }

    return { success: true, synced: !!args.sandboxID };
  },
});
