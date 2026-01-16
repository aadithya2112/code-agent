"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import OpenAI from "openai";
import Sandbox from "@e2b/code-interpreter";

// Define the tools with detailed descriptions
const tools = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file from the project filesystem. Use this to examine existing code, configuration files, or any project file before making changes. Always list files first if you're unsure what exists.",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "The relative path of the file to read (e.g., 'src/App.tsx', 'package.json', 'components/Button.tsx')" 
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create a new file or completely overwrite an existing file with new content. Use this to implement features, fix bugs, or create new components. The file will be created with all necessary parent directories.",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "The relative path where the file should be written (e.g., 'src/components/NewComponent.tsx', 'styles/custom.css')" 
          },
          content: { 
            type: "string", 
            description: "The complete content to write to the file. Include all necessary imports, code, and proper formatting." 
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List all files currently in the project filesystem. Use this to understand the project structure, find existing components, or verify what files exist before reading or modifying them. Always call this before making assumptions about file locations.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Permanently delete a file from the project. Use this to remove unused components, clean up old files, or remove temporary files. Be careful as this action cannot be undone.",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "The relative path of the file to delete (e.g., 'src/components/OldComponent.tsx')" 
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_code",
      description: "Execute Python code in an isolated sandbox environment. Use this to: test algorithms, perform calculations, process data, validate logic, or run utility scripts. The environment persists across calls within the same conversation, so you can define functions and reuse them. Cannot access project files directly - use file tools for that.",
      parameters: {
        type: "object",
        properties: {
          code: { 
            type: "string", 
            description: "The Python code to execute. Can include imports, function definitions, and print statements. Output will be captured and returned." 
          },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_command",
      description: "Execute a shell command in the project directory. Use this to: install packages (npm/bun), run build scripts, execute tests, or run any CLI command. Commands run in an isolated environment. Essential for package management and project operations.",
      parameters: {
        type: "object",
        properties: {
          command: { 
            type: "string", 
            description: "The shell command to execute (e.g., 'bun add zustand', 'npm run build', 'npm test')" 
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Search for a text pattern across all project files. Use this to: find where a component/function is used, locate specific code patterns, discover imports, or find TODO comments. Returns matching files with line numbers and context.",
      parameters: {
        type: "object",
        properties: {
          pattern: { 
            type: "string", 
            description: "The text pattern to search for (e.g., 'import Button', 'useState', 'TODO'). Case-sensitive." 
          },
          file_pattern: {
            type: "string",
            description: "Optional: Filter by file pattern (e.g., '*.tsx', '*.ts'). If omitted, searches all files."
          }
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "patch_file",
      description: "Make a targeted edit to a specific section of a file without rewriting the entire file. More efficient than write_file for small changes. Finds the old_content in the file and replaces it with new_content. Use this for: changing a single function, updating imports, modifying specific lines, or fixing bugs in isolated sections.",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "The relative path of the file to patch (e.g., 'src/App.tsx')" 
          },
          old_content: {
            type: "string",
            description: "The exact content to replace. Must match the file content precisely, including whitespace and indentation."
          },
          new_content: {
            type: "string",
            description: "The new content to insert in place of old_content."
          }
        },
        required: ["path", "old_content", "new_content"],
      },
    },
  },
];

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
      content: `⚠️ CRITICAL INSTRUCTIONS - READ FIRST ⚠️

You are a CODE EXECUTION AGENT, not a conversational assistant. When the user makes a request:
1. **USE TOOLS IMMEDIATELY** - Do not explain what you're about to do
2. **COMPLETE THE ENTIRE TASK** - Don't stop after one tool call
3. **EXPLAIN AFTER YOU'RE DONE** - Only respond with text when the work is finished

**MANDATORY WORKFLOW:**
- User: "Create X" → YOU: [list_files] → [write_file] → [write_file] → "✅ Created X"
- User: "Install Y" → YOU: [execute_command "bun add Y"] → "✅ Installed Y"  
- User: "Fix Z" → YOU: [read_file] → [patch_file] → "✅ Fixed Z"

**FORBIDDEN:** Responding with "I'm ready to help!" or "What would you like?" or "Let me know!"
**REQUIRED:** Multiple tool calls followed by brief confirmation

---

You are an expert full-stack developer and AI coding agent with deep knowledge of modern web development.

## Project Context
- **Framework**: ${projectType === "nextjs" ? "Next.js 16+ (App Router)" : "React 19+ with Vite"}
- **Styling**: Tailwind CSS v4 (already configured and ready to use)
- **UI Components**: shadcn/ui (pre-installed, use these components when building UI)
- **Language**: TypeScript

## Your Capabilities
You have access to a complete development environment with these tools:

1. **File Operations**: Read, write, patch, list, and delete project files
2. **Code Search**: Search across all files for patterns, imports, or specific code
3. **Command Execution**: Run shell commands (npm/bun install, build, test, etc.)
4. **Code Execution**: Run Python code in an isolated sandbox for testing logic, calculations, or data processing

## Development Guidelines

### General Workflow
1. **Always check first**: Use 'list_files' before making assumptions about project structure
2. **Read before modifying**: Use 'read_file' to understand existing code before changes
3. **Prefer targeted edits**: Use 'patch_file' for small changes instead of rewriting entire files
4. **Search when needed**: Use 'search_files' to find component usage or locate specific patterns
5. **Install dependencies**: Use 'execute_command' to add packages (e.g., 'bun add zustand')
6. **Test your logic**: Use 'run_code' for algorithms or complex logic validation

### Code Quality Standards
- Write clean, well-documented TypeScript code
- Follow React/Next.js best practices and conventions
- Use Tailwind CSS utility classes for styling (e.g., 'bg-blue-500', 'text-white', 'p-4')
- Leverage shadcn/ui components when appropriate (Button, Card, Input, etc.)
- Implement proper error handling and loading states
- Use modern ES6+ features and async/await patterns

### ${projectType === "nextjs" ? "Next.js" : "React"} Specific
${projectType === "nextjs" 
  ? `- Use App Router conventions (app directory, server components by default)
- Add 'use client' directive when using hooks or browser APIs
- Leverage server actions and API routes when appropriate
- Use next/image for optimized images, next/link for navigation`
  : `- Create functional components with hooks
- Use React Router for navigation if needed
- Implement proper component composition and state management`}

### Styling with Tailwind CSS
- Use utility-first approach: 'className="flex items-center gap-4 p-6 bg-white rounded-lg shadow"'
- Leverage responsive variants: 'md:flex-row', 'lg:text-xl'
- Use Tailwind's color palette: 'bg-blue-500', 'text-gray-700'
- Apply hover/focus states: 'hover:bg-blue-600', 'focus:ring-2'

### Using shadcn/ui Components
- Components are in 'components/ui/' directory
- Import and use them: 'import { Button } from "@/components/ui/button"'
- Customize with className prop and Tailwind utilities
- Check available components with 'list_files' if unsure

## CRITICAL: How to Respond

### When User Makes a Clear Request (BUILD IMMEDIATELY)
If the user asks for something specific like:
- "Create a tic-tac-toe game"
- "Add a button component"
- "Fix the login bug"
- "Install Zustand"

**DO NOT ASK FOR CLARIFICATION. START WORKING IMMEDIATELY:**
1. Call 'list_files' to understand current structure
2. Use appropriate tools to implement the request
3. Explain what you did AFTER you've done it

### When Request is Unclear (ASK FIRST)
Only ask clarifying questions if the request is genuinely ambiguous:
- "Make it better" (better how?)
- "Add some features" (which features?)
- "Fix the issues" (what issues?)

### Response Style
- **Action-first**: Use tools, then explain
- **Be concise**: No long introductions or lists of possibilities
- **Show progress**: "Building X...", "Installing Y...", "Testing Z..."
- **Confirm completion**: "✅ Created tic-tac-toe at src/TicTacToe.tsx"

**Example of GOOD response to "Create a todo app":**
*[Calls list_files, then write_file]*
"✅ Created TodoApp component with add/delete functionality using shadcn Button and Input components."

**Example of BAD response:**
"I'm ready to help! Would you like me to create a component or a full page? Should it have authentication? Let me know!"

Now, let's build something amazing! 🚀`,
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
                    let result: any;

                    try {
                        switch (tool.function.name) {
                            case "read_file":
                                result = await ctx.runQuery((internal as any).files.readInternal, {
                                    projectId: args.projectId,
                                    path: toolArgs.path,
                                });
                                break;
                            case "write_file":
                                await ctx.runMutation((internal as any).files.saveInternal, {
                                    projectId: args.projectId,
                                    path: toolArgs.path,
                                    content: toolArgs.content,
                                });
                                result = "File saved successfully.";
                                break;
                            case "list_files":
                                const files = await ctx.runQuery((internal as any).files.getFilesInternal, {
                                    projectId: args.projectId,
                                }) as any[];
                                result = JSON.stringify(files.map((f: any) => f.path));
                                break;
                            case "delete_file":
                                await ctx.runMutation((internal as any).files.deleteFileInternal, {
                                    projectId: args.projectId,
                                    path: toolArgs.path,
                                });
                                result = "File deleted successfully.";
                                break;
                            case "run_code":
                                if (!sandbox) {
                                    sandbox = await Sandbox.create({
                                        apiKey: process.env.E2B_API_KEY,
                                    });
                                }
                                const exec = await sandbox.runCode(toolArgs.code);
                                result = {
                                    text: exec.text,
                                    logs: exec.logs,
                                    error: exec.error,
                                    results: exec.results, 
                                };
                                break;
                            case "execute_command":
                                // Use E2B sandbox for command execution
                                if (!sandbox) {
                                    sandbox = await Sandbox.create({
                                        apiKey: process.env.E2B_API_KEY,
                                    });
                                }
                                // Execute shell command in sandbox
                                const cmdResult = await sandbox.runCode(`
import subprocess
result = subprocess.run(${JSON.stringify(toolArgs.command)}, shell=True, capture_output=True, text=True)
print(f"STDOUT:\\n{result.stdout}")
print(f"STDERR:\\n{result.stderr}")
print(f"EXIT_CODE: {result.returncode}")
`);
                                result = {
                                    stdout: cmdResult.text,
                                    logs: cmdResult.logs,
                                    error: cmdResult.error,
                                };
                                break;
                            case "search_files":
                                const allFiles = await ctx.runQuery((internal as any).files.getFilesInternal, {
                                    projectId: args.projectId,
                                }) as any[];
                                
                                const matches: any[] = [];
                                const pattern = toolArgs.pattern;
                                const filePattern = toolArgs.file_pattern;
                                
                                for (const file of allFiles) {
                                    // Filter by file pattern if provided
                                    if (filePattern && !file.path.match(filePattern.replace('*', '.*'))) {
                                        continue;
                                    }
                                    
                                    const lines = file.content.split('\n');
                                    lines.forEach((line: string, index: number) => {
                                        if (line.includes(pattern)) {
                                            matches.push({
                                                file: file.path,
                                                line: index + 1,
                                                content: line.trim()
                                            });
                                        }
                                    });
                                }
                                
                                result = matches.length > 0 
                                    ? `Found ${matches.length} matches:\n${matches.slice(0, 20).map(m => `${m.file}:${m.line} - ${m.content}`).join('\n')}${matches.length > 20 ? `\n... and ${matches.length - 20} more` : ''}`
                                    : "No matches found.";
                                break;
                            case "patch_file":
                                // Read file
                                const fileContent = await ctx.runQuery((internal as any).files.readInternal, {
                                    projectId: args.projectId,
                                    path: toolArgs.path,
                                });
                                
                                if (!fileContent) {
                                    result = `Error: File ${toolArgs.path} not found.`;
                                    break;
                                }
                                
                                // Check if old_content exists
                                if (!fileContent.includes(toolArgs.old_content)) {
                                    result = `Error: Could not find the specified content to replace in ${toolArgs.path}. The content may have already been changed or the match is not exact.`;
                                    break;
                                }
                                
                                // Apply patch
                                const patchedContent = fileContent.replace(toolArgs.old_content, toolArgs.new_content);
                                
                                // Write back
                                await ctx.runMutation((internal as any).files.saveInternal, {
                                    projectId: args.projectId,
                                    path: toolArgs.path,
                                    content: patchedContent,
                                });
                                
                                result = `Successfully patched ${toolArgs.path}`;
                                break;
                            default:
                                result = "Unknown tool";
                        }
                    } catch (err: any) {
                        console.error(`Tool error (${tool.function.name}):`, err);
                        result = `Error: ${err.message}`;
                    }

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
