"use client";

import ChatInterface from "@/components/chat-interface";
import PreviewPane from "@/components/preview-pane";
import { useState, useEffect } from "react";
import { initializeProject, stopSandbox, detectProjectType } from "@/lib/actions";
import { Id } from "@/convex/_generated/dataModel";
import { useParams, useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function ProjectPage() {
    const params = useParams();
    const projectId = params.projectId as Id<"projects">;
    
    // Validate project existence / access
    // We could use a query here to just fetch title, or handle 404
    // implicitly via the ChatInterface not loading messages.

    const [sandboxID, setSandboxID] = useState<string | null>(null);
    const [port, setPort] = useState(0);
    const [projectType, setProjectType] = useState<"react" | "nextjs" | null>(null);
    const [status, setStatus] = useState<"idle" | "working" | "ready" | "stopping">("idle");
    const applyTemplate = useMutation(api.projects.applyTemplate);
    const clearRestartFlag = useMutation(api.projects.clearRestartFlag);
    const project = useQuery(api.projects.get, { projectId });

    const [hasFiles, setHasFiles] = useState(false);
    
    // Check if files exist to determine if we should auto-start or wait for prompt
    const files = useQuery(api.files.getFiles, { projectId });
    
    useEffect(() => {
        if (files && files.length > 0) {
            setHasFiles(true);
        }
    }, [files]);

    const startDevServer = async () => {
        try {
            setStatus("working");
            const result = await initializeProject(projectId);
            setSandboxID(result.sandboxId);
            setPort(result.port);
            // Deduce project type from port for PreviewPane usage (optional visual)
            setProjectType(result.port === 3000 ? "nextjs" : "react"); 
            setStatus("ready");
        } catch(e) {
            console.error("Failed to start server:", e);
            setStatus("idle");
        }
    };

    // Auto-start if files exist and we are idle (and haven't started yet)
    // We use a ref or simple check to assume if we just loaded and have files, we work.
    useEffect(() => {
        if (status === "idle" && hasFiles && !sandboxID) {
            startDevServer();
        }
    }, [hasFiles /*, status, sandboxID */]); 
    // Careful with dependencies to avoid loop. 
    // Just run once when `hasFiles` becomes true if IDLE.

    const handleInitialize = async (prompt: string) => {
        try {
            setStatus("working");
            
            // 1. Detect Type
            const type = await detectProjectType(prompt);
            setProjectType(type);

            // 2. Apply Template (Authenticated Client Mutation)
            await applyTemplate({ projectId, template: type });

            // 3. Start Sandbox
            await startDevServer();

        } catch (e) {
            console.error(e);
            setStatus("idle");
        }
    };

    // Watch for agent completion signal to restart sandbox
    useEffect(() => {
        const handleAutoRestart = async () => {
            // Check if we need restart AND have a sandbox AND it is ready
            if (project?.needsSandboxRestart && sandboxID && status === "ready") {
                console.log("Agent completed - restarting dev server...");
                
                // Clear flag immediately to prevent re-trigger
                await clearRestartFlag({ projectId });
                
                setStatus("working");

                try {
                    // Try to hot-restart first (faster)
                    const { restartDevServer } = await import("@/lib/actions");
                    await restartDevServer(sandboxID, projectId);
                    console.log("Dev server restarted successfully!");
                    setStatus("ready");
                } catch (error) {
                    console.error("Hot restart failed, falling back to full reboot:", error);
                    // Fallback to full stop/start if hot restart fails
                    await stopSandbox(sandboxID);
                    setSandboxID(null);
                    
                    setTimeout(async () => {
                         try {
                            const result = await initializeProject(projectId);
                            setSandboxID(result.sandboxId);
                            setPort(result.port);
                            setStatus("ready");
                         } catch(e) {
                             console.error("Full recovery failed:", e);
                             setStatus("idle");
                         }
                    }, 1000);
                }
            }
        };
        
        handleAutoRestart();
    }, [project?.needsSandboxRestart, sandboxID, status]);

    const handleStop = async () => {
        if (!sandboxID) return;
        setStatus("stopping");
        await stopSandbox(sandboxID);
        setSandboxID(null);
        // Do NOT clear projectType, so Preview knows what icon to show or that we exist
        setStatus("idle");
    };

    return (
        <div className="flex min-h-screen bg-black flex-col font-sans overflow-hidden h-screen">
             {/* Simple Header */}
             <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 bg-neutral-950">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="text-neutral-400 hover:text-white transition-colors">
                        <ArrowLeft size={18} />
                    </Link>
                    <span className="text-sm font-medium text-neutral-200">Workspace</span>
                </div>
                <div className="flex items-center gap-4">
                     {status === "ready" && <div className="flex items-center gap-2 text-xs text-green-500"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/> Sandbox Active</div>}
                    <UserButton />
                </div>
             </div>

             <div className="flex flex-1 p-4 gap-4 overflow-hidden">
                {/* Sidebar / Chat */}
                <div className="w-1/3 min-w-[400px] flex flex-col h-full">
                    <ChatInterface 
                        onInitialize={handleInitialize} 
                        isInitializing={status === "working"}
                        hasActiveSandbox={!!sandboxID}
                        projectId={projectId}
                    />
                </div>

                {/* Main / Preview */}
                <div className="flex-1 h-full">
                    <PreviewPane 
                        projectId={projectId}
                        sandboxID={sandboxID} 
                        port={port}
                        projectType={projectType}
                        status={status}
                        onStop={handleStop}
                        onStart={startDevServer}
                    />
                </div>
             </div>
        </div>
    );
}
