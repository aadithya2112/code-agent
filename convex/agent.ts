"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import OpenAI from "openai";
import Sandbox from "@e2b/code-interpreter";

import { tools as toolImpls } from "./lib/tools";

// Define the tools with detailed descriptions
import { toolDefinitions as tools } from "./lib/tool_definitions";
import { getSystemPrompt } from "./lib/prompts";

// API Definition
export const chat = action({
  args: {
    projectId: v.id("projects"),
    userId: v.string(), // Pass userId from the mutation
    latestUserMessage: v.optional(v.string()), // The user message that triggered this
    messages: v.optional(v.array(v.object({
        role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
        content: v.string(),
    })))
  },
  handler: async (ctx, args) => {
    console.log("Starting agent chat for project:", args.projectId);
    
    // Initialize OpenAI client pointing to OpenRouter
    const openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    // Fetch project metadata and verify ownership
    const project = await ctx.runQuery((internal as any).projects.getInternal, { projectId: args.projectId }) as any;
    
    if (!project) {
        console.error("Project not found");
        return;
    }
    
    // Verify the user owns this project
    if (project.userId !== args.userId) {
        console.error("Unauthorized: User does not own this project");
        return;
    }
    
    const projectType = project?.projectType || "react"; // Default to react if not set
    
    // Fetch existing messages
    const dbMessages = await ctx.runQuery((internal as any).messages.list, { projectId: args.projectId }) as any[];
    
    console.log(`DEBUG: Fetched ${dbMessages.length} messages from DB`);
    
    // Map DB messages to OpenAI format
    let messages = dbMessages.map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    
    // If we have a latestUserMessage and it's not in the DB messages yet (race condition), add it
    if (args.latestUserMessage) {
        const lastDbMessage = dbMessages[dbMessages.length - 1];
        if (!lastDbMessage || lastDbMessage.content !== args.latestUserMessage) {
            console.log("DEBUG: Adding latestUserMessage to history (not in DB yet)");
            messages.push({
                role: "user" as const,
                content: args.latestUserMessage
            });
        }
    }
    
    console.log("DEBUG: Final message count:", messages.length);
    console.log("DEBUG: Last message:", messages[messages.length - 1]);

    // Dynamic system prompt with project context
    const systemMessage = {
      role: "system" as const,
      content: getSystemPrompt(projectType),
    };

    const currentHistory = [systemMessage, ...messages];

    // Main Agent Loop
    const MAX_TURNS = 5;
    let turn = 0;

    let finalResponse = "";

    while (turn < MAX_TURNS) {
        turn++;
        console.log(`Turn ${turn}...`);

        try {
            const response = await openai.chat.completions.create({
                model: "deepseek/deepseek-chat", 
                messages: currentHistory as any, // Cast to avoid strict type issues with 'tools'
                tools: tools as any,
                tool_choice: "auto",
            });

            const message = response.choices[0].message;
            if (!message) break;

            // Add the assistant's message to history
            currentHistory.push(message as any);

            if (message.content) {
                console.log("Agent thought:", message.content);
                if (!message.tool_calls || message.tool_calls.length === 0) {
                    finalResponse = message.content;
                    break;
                }
            }

            if (message.tool_calls) {
                // Initialize E2B sandbox if needed
                let sandbox: Sandbox | null = null;

                for (const toolCall of message.tool_calls) {
                    const tool = toolCall as any;
                    console.log(`Executing tool: ${tool.function.name}`);
                    const toolArgs = JSON.parse(tool.function.arguments);
                    
                    // Log tool execution to UI
                    const logId = await ctx.runMutation((internal as any).messages.sendInternal, {
                        projectId: args.projectId,
                        role: "system",
                        content: `Executing ${tool.function.name}...`,
                        userId: args.userId,
                        toolCall: {
                            name: tool.function.name,
                            args: toolArgs
                        }
                    });

                    let result: any;

                    try {
                        // Ensure sandbox for execution tools
                        if ((tool.function.name === "run_code" || tool.function.name === "execute_command") && !sandbox) {
                            sandbox = await Sandbox.create({
                                apiKey: process.env.E2B_API_KEY,
                            });
                        }

                        const handler = toolImpls[tool.function.name as keyof typeof toolImpls];
                        if (handler) {
                             // Pass safe context
                             result = await handler({ 
                                ctx, 
                                projectId: args.projectId, 
                                userId: args.userId, 
                                sandbox: sandbox || undefined 
                             }, toolArgs);
                        } else {
                            result = "Unknown tool";
                        }

                    } catch (err: any) {
                        console.error(`Tool error (${tool.function.name}):`, err);
                        result = `Error: ${err.message}`;
                    }

                    // Update log with result
                    await ctx.runMutation((internal as any).messages.updateInternal, {
                        messageId: logId,
                        toolCall: {
                            name: tool.function.name,
                            args: toolArgs,
                            result: typeof result === "string" ? result : JSON.stringify(result) 
                        }
                    });

                    // Append tool result related to the tool call
                    currentHistory.push({
                        role: "tool",
                        tool_call_id: tool.id,
                        content: typeof result === "string" ? result : JSON.stringify(result),
                    } as any);
                }
                
                if (sandbox) {
                    // Sandbox cleanup might be automatic or different in this version, check if close exists
                    // Based on type definition, generic cleanup might not be exposed as close() on Sandbox class directly or it extends Sandbox$1
                    // The d.ts doesn't show close(), so let's skip explicit close or check docs. 
                    // Actually, Sandbox extends Sandbox$1, and usually has a close/kill. 
                    // But to be safe and avoid TS error if it's missing from d.ts shown, let's cast or check.
                    // The user dump didn't show 'close' method in Sandbox class, but maybe it's inherited.
                    // For now, let's assume it's fine to leave open (it times out) or try to call it if it exists.
                    // Explicitly casting to any to call close() if it exists to be safe, or just relying on timeout.
                    // Actually, let's just attempt to call close if it exists.
                    if ('close' in sandbox) {
                         await (sandbox as any).close();
                    } else if ('kill' in sandbox) {
                         await (sandbox as any).kill();
                    }
                }
            }
        } catch (error) {
            console.error("Fatal Agent Error:", error);
            await ctx.runMutation((internal as any).messages.sendInternal, {
                projectId: args.projectId,
                role: "assistant",
                content: "I encountered an error while processing your request.",
                userId: args.userId,
            });
            return;
        }
    }

    // Send final response
    if (finalResponse) {
        await ctx.runMutation((internal as any).messages.sendInternal, {
            projectId: args.projectId,
            role: "assistant",
            content: finalResponse,
            userId: args.userId,
        });
        
        // Signal frontend to restart sandbox so changes appear
        await ctx.runMutation((internal as any).projects.setRestartFlag, {
            projectId: args.projectId,
        });
    }
  },
});
