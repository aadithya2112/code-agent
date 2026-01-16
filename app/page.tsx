"use client";

import ChatInterface from "@/components/chat-interface";
import PreviewPane from "@/components/preview-pane";
import { useState } from "react";
import { initializeProject, stopSandbox } from "@/lib/actions";

export default function Home() {
  const [sandboxID, setSandboxID] = useState<string | null>(null);
  const [port, setPort] = useState(0);
  const [projectType, setProjectType] = useState<"react" | "nextjs" | null>(null);
  const [status, setStatus] = useState<"idle" | "working" | "ready" | "stopping">("idle");

  const handleInitialize = async (prompt: string) => {
    try {
        setStatus("working");
        // initializeProject handles: start sandbox -> detect type -> clone -> install -> start server
        const result = await initializeProject(prompt);
        
        setSandboxID(result.sandboxId);
        setPort(result.port);
        setProjectType(result.type);
        setStatus("ready");
    } catch (e) {
        console.error(e);
        setStatus("idle");
        // We could bubble error to chat here
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
    <main className="flex min-h-screen bg-black p-4 gap-4 h-screen font-sans">
       {/* Sidebar / Chat */}
       <div className="w-1/3 min-w-[400px]">
          <ChatInterface 
            onInitialize={handleInitialize} 
            isInitializing={status === "working"}
            hasActiveSandbox={!!sandboxID}
          />
       </div>

       {/* Main / Preview */}
       <div className="flex-1">
          <PreviewPane 
            sandboxID={sandboxID} 
            port={port}
            projectType={projectType}
            status={status}
            onStop={handleStop}
          />
       </div>
    </main>
  );
}