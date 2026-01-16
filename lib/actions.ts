"use server";

import { Sandbox } from "@e2b/code-interpreter";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

// We need to keep track of sandboxes to kill them, but in a serverless/server action env
// we might lose state. For a simple demo, we'll return the ID and rely on the client to pass it back.
// The Sandbox object relies on connecting to the running instance by ID.

export async function startSandbox() {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) throw new Error("E2B_API_KEY not found");

  const sandbox = await Sandbox.create({ apiKey });
  return sandbox.sandboxId;
}

export async function stopSandbox(sandboxId: string) {
    if (!sandboxId) return;
    try {
        const sandbox = await Sandbox.connect(sandboxId);
        await sandbox.kill();
        return true;
    } catch (e) {
        console.error("Error killing sandbox:", e);
        return false;
    }
}

export async function detectProjectType(prompt: string): Promise<"react" | "nextjs"> {
    if (!prompt) return "react";

    try {
        const completion = await openai.chat.completions.create({
            model: "openai/gpt-oss-20b",
            messages: [
                {
                    role: "system",
                    content: "You are an expert developer. Analyze the user's request to decide if they need a Next.js project or a React project.\n" +
                             "If the user explicitly asks for Next.js OR describes features strictly requiring server-side rendering/API routes, choose 'nextjs'.\n" +
                             "Otherwise, prefer 'react'."
                },
                { role: "user", content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 50,
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "project_type",
                    strict: true,
                    schema: {
                        type: "object",
                        properties: {
                            type: {
                                type: "string",
                                enum: ["react", "nextjs"],
                                description: "The determined project type"
                            }
                        },
                        required: ["type"],
                        additionalProperties: false
                    }
                }
            }
        });
        
        const content = completion.choices[0]?.message?.content;
        if (!content) return "react";

        const result = JSON.parse(content);
        return result.type === "nextjs" ? "nextjs" : "react";
    } catch (e) {
        console.error("Error detecting project type:", e);
        return "react"; // Fallback
    }
}

export async function setupProject(sandboxId: string, template: "react" | "nextjs" = "react") {
    const sandbox = await Sandbox.connect(sandboxId);
    
    let repoUrl = "";
    let dirName = "";
    let port = 0;

    if (template === "react") {
        repoUrl = "https://github.com/aadithya2112/code-agent-react-starter.git"; 
        dirName = "code-agent-react-starter";
        port = 5173;
    } else {
        repoUrl = "https://github.com/aadithya2112/code-agent-nextjs-starter.git";
        dirName = "code-agent-nextjs-starter";
        port = 3000;
    }

    // 1. Clone
    await sandbox.commands.run(`git clone ${repoUrl}`);

    // 2. Install (NPM)
    await sandbox.commands.run(`cd ${dirName} && npm install`);

    // 3. Start Server
    // The repositories are now pre-configured to bind to 0.0.0.0 and allow hosts.
    // For React: vite.config.ts has server: { host: true, allowedHosts: true }
    // For Next.js: package.json script has "dev": "next dev -H 0.0.0.0" (or equivalent config)
    
    await sandbox.commands.run(`cd ${dirName} && npm run dev`, { background: true });

    // Return the port we expect
    return port;
}

export async function initializeProject(prompt: string) {
    const sandboxId = await startSandbox();
    const type = await detectProjectType(prompt);
    
    // We can return early info to UI if we want (streaming), but here we await setup
    const port = await setupProject(sandboxId, type);
    
    return { sandboxId, type, port };
}
