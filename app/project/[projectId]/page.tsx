"use client";

import ChatInterface from "@/components/chat-interface";
import PreviewPane from "@/components/preview-pane";
import { useState, useEffect } from "react";
import { initializeProject, stopSandbox } from "@/lib/actions";
import { Id } from "@/convex/_generated/dataModel";
import { useParams, useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useQuery } from "convex/react";
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

    const handleInitialize = async (prompt: string) => {
        try {
            setStatus("working");
            const result = await initializeProject(prompt);
            
            setSandboxID(result.sandboxId);
            setPort(result.port);
            setProjectType(result.type);
            setStatus("ready");
        } catch (e) {
            console.error(e);
            setStatus("idle");
        }
    };

    const handleStop = async () => {
        if (!sandboxID) return;
        setStatus("stopping");
        await stopSandbox(sandboxID);
        setSandboxID(null);
        setProjectType(null);
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
                        sandboxID={sandboxID} 
                        port={port}
                        projectType={projectType}
                        status={status}
                        onStop={handleStop}
                    />
                </div>
             </div>
        </div>
    );
}
