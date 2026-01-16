"use server";

import { Sandbox } from "@e2b/code-interpreter";
import { OpenAI } from "openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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

// Hydrate E2B from Convex Files
export async function hydrateSandbox(sandbox: Sandbox, projectId: Id<"projects">) {
    const files = await convex.query(api.files.getFiles, { projectId });
    console.log(`[Hydrate] Found ${files.length} files for project ${projectId}`);

    if (files.length === 0) {
        throw new Error("No files found in Convex. Template application failed?");
    }

    // 2. Write to E2B (Parallel) to /home/user/app
    await Promise.all(files.map(async file => {
        // file.path is like "/app/page.tsx" or "/package.json"
        
        // Strip leading slash to be safe for joining
        const relativePath = file.path.startsWith("/") ? file.path.substring(1) : file.path;
        const fullPath = `/home/user/app/${relativePath}`;
        
        const dir = fullPath.split("/").slice(0, -1).join("/");
        if (dir) {
             try { await sandbox.files.makeDir(dir); } catch(e) {}
        }
        return await sandbox.files.write(fullPath, file.content);
    }));

    // DEBUG: Check files exist
    const ls = await sandbox.files.list("/home/user/app");
    console.log(`[Hydrate] App files: ${ls.map(f => f.name).join(", ")}`);

    const hasPackageJson = ls.some(f => f.name === "package.json");
    if (!hasPackageJson) {
        throw new Error("Hydration failed: package.json missing in /home/user/app");
    }
}

export async function setupProject(sandboxId: string, projectId: Id<"projects">) {
    const sandbox = await Sandbox.connect(sandboxId);
    
    // 1. Hydrate Code from DB
    await hydrateSandbox(sandbox, projectId);

    // 2. Install Dependencies
    console.log("[Setup] Running npm install...");
    try {
        const install = await sandbox.commands.run(`cd /home/user/app && npm install`);
        if (install.exitCode !== 0) {
            console.error("npm install failed:", install.stderr);
            throw new Error(`npm install failed: ${install.stderr}`);
        }
    } catch (e: any) {
        console.error("npm install crashed:", JSON.stringify(e, null, 2));
        if (e.stderr) console.error("Stderr from crash:", e.stderr);
        throw e;
    }

    // 3. Start Server
    const packageJsonContent = await sandbox.files.read("/home/user/app/package.json");
    const packageJson = JSON.parse(packageJsonContent);
    const isNext = !!(packageJson.dependencies?.next || packageJson.devDependencies?.next);
    const port = isNext ? 3000 : 5173;
    
    console.log(`[Setup] Detected project type: ${isNext ? "Next.js" : "React"} (Port ${port})`);

    const start = await sandbox.commands.run(`cd /home/user/app && npm run dev`, { background: true });
    console.log(`[Setup] Server started (PID ${start.pid})`);

    return port;
}

export async function checkSandboxActive(sandboxId: string) {
    try {
        // Try to connect to check if valid
        const sandbox = await Sandbox.connect(sandboxId);
        // Maybe check if it's 'running' is enough? 
        // Sandbox.connect doesn't throw if it exists.
        return true;
    } catch (e) {
         return false;
    }
}

export async function restartDevServer(sandboxId: string, projectId: Id<"projects">) {
    if (!sandboxId) throw new Error("Sandbox ID required");
    
    console.log(`[Restart] Connecting to sandbox ${sandboxId}...`);
    const sandbox = await Sandbox.connect(sandboxId);
    
    // 1. Kill existing dev server
    // We use a broad kill pattern for common dev servers
    console.log("[Restart] Killing old processes...");
    try {
        await sandbox.commands.run("pkill -f 'next-server' || pkill -f 'vite' || pkill -f 'node'");
    } catch (e: any) {
        // Ignore errors from pkill (e.g. if no process found or if it kills itself weirdly)
        console.log("[Restart] Kill command checked:", String(e));
    }
    
    // 2. Sync latest files
    console.log("[Restart] Syncing files...");
    await hydrateSandbox(sandbox, projectId);
    
    // 3. Start Server again
    // We need to re-detect port/type just to be safe, or assume same?
    // Safe to re-read package.json from disk (which we just synced)
    const packageJsonContent = await sandbox.files.read("/home/user/app/package.json");
    const packageJson = JSON.parse(packageJsonContent);
    const isNext = !!(packageJson.dependencies?.next || packageJson.devDependencies?.next);
    const port = isNext ? 3000 : 5173;
    
    console.log(`[Restart] Starting ${isNext ? "Next.js" : "React"} server...`);
    const start = await sandbox.commands.run(`cd /home/user/app && npm run dev`, { background: true });
    
    console.log(`[Restart] Done. New PID: ${start.pid}`);
    return { success: true, port };
}

export async function initializeProject(projectId: Id<"projects">) {
    const sandboxId = await startSandbox();
    
    // 0. Files are expected to be in Convex by now (handled by client)

    // 1. Setup (Hydrate + Install + Start)
    const port = await setupProject(sandboxId, projectId);
    
    return { sandboxId, port };
}
