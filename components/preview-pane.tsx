"use client";

import { Square, Globe, RefreshCcw, ArrowLeft, ArrowRight, Code, AppWindow } from "lucide-react";
import { useState, useEffect } from "react";
import { Loader } from "@/components/ai-elements/loader";
import {
  WebPreview,
  WebPreviewNavigation,
  WebPreviewUrl,
  WebPreviewBody,
  WebPreviewNavigationButton,
} from "@/components/ai-elements/web-preview";
import CodeExplorer from "@/components/code-explorer";
import { Id } from "@/convex/_generated/dataModel";

interface PreviewPaneProps {
  projectId: Id<"projects">;
  sandboxID: string | null;
  port: number;
  projectType: "react" | "nextjs" | null;
  status: "idle" | "working" | "ready" | "stopping";
  onStop: () => void;
  onStart: () => void;
}

export default function PreviewPane({ projectId, sandboxID, port, projectType, status, onStop, onStart }: PreviewPaneProps) {
  const [localPort, setLocalPort] = useState(port);
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");

  // Sync prop port to local state when it changes
  useEffect(() => {
    if (port) setLocalPort(port);
  }, [port]);

  const baseUrl = sandboxID
    ? `https://${localPort}-${sandboxID}.e2b.app` 
    : "";

  if (!sandboxID || status === "idle") {
      // If we have a project type and are idle, it means we are STOPPED.
      // Show Play Button.
      if (projectType) {
          return (
            <div className="flex flex-col h-full bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden shadow-lg relative items-center justify-center">
                 <div className="flex flex-col items-center gap-6 z-10">
                    <div className="w-20 h-20 rounded-full bg-neutral-800/50 border border-neutral-700 flex items-center justify-center">
                        <button 
                            onClick={onStart}
                            className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-400 text-white flex items-center justify-center shadow-lg transform transition-all hover:scale-105 active:scale-95 group"
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 ml-1 transition-transform group-hover:scale-110">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </button>
                    </div>
                    <div className="text-center">
                        <p className="text-neutral-300 font-medium">Dev Server Stopped</p>
                        <p className="text-xs text-neutral-500 mt-1">Click play to resume coding</p>
                    </div>
                 </div>
            </div>
          );
      }

      return (
        <div className="flex flex-col h-full bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden shadow-lg relative items-center justify-center">
             <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
                 style={{ 
                     backgroundImage: 'radial-gradient(circle at 1px 1px, #404040 1px, transparent 0)', 
                     backgroundSize: '20px 20px' 
                 }} 
            />
            <div className="flex flex-col items-center gap-3 opacity-60 relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-neutral-900/50 border border-neutral-800/50 flex items-center justify-center rotate-3 transform transition-transform hover:rotate-6">
                    <Globe size={32} className="text-neutral-700" />
                </div>
                <p className="text-sm text-neutral-600 font-medium tracking-wide">PREVIEW AREA</p>
            </div>
        </div>
      );
  }

  return (
    <WebPreview 
        className="h-full border-neutral-800 bg-neutral-900 shadow-lg" 
        defaultUrl={baseUrl}
        key={baseUrl} // Reset when URL base changes
    >
      <WebPreviewNavigation className="bg-neutral-950/80 backdrop-blur-sm border-b border-neutral-800 p-2 gap-2">
        <div className="flex items-center gap-1">
            <WebPreviewNavigationButton disabled={viewMode !== "preview"} className="text-neutral-400">
                 <ArrowLeft size={14} />
            </WebPreviewNavigationButton>
             <WebPreviewNavigationButton disabled={viewMode !== "preview"} className="text-neutral-400">
                 <ArrowRight size={14} />
            </WebPreviewNavigationButton>
             <WebPreviewNavigationButton disabled={viewMode !== "preview"} tooltip="Reload" className="text-neutral-400 hover:text-white">
                 <RefreshCcw size={14} />
            </WebPreviewNavigationButton>
        </div>

        <WebPreviewUrl className="bg-neutral-900 border-neutral-800 text-neutral-300 h-8" disabled={viewMode !== "preview"} />

        <div className="flex items-center gap-2 ml-2">
             {/* View Toggle */}
             <div className="flex items-center bg-neutral-900 rounded-lg border border-neutral-800 p-0.5">
                <button
                    onClick={() => setViewMode("preview")}
                    className={`p-1.5 rounded-md transition-all ${viewMode === "preview" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300"}`}
                    title="Web Preview"
                >
                    <AppWindow size={14} />
                </button>
                <button
                    onClick={() => setViewMode("code")}
                    className={`p-1.5 rounded-md transition-all ${viewMode === "code" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300"}`}
                    title="Code Explorer"
                >
                    <Code size={14} />
                </button>
             </div>

             {status === "ready" && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20 whitespace-nowrap">
                  LIVE
                </span>
              )}
             {status === "working" && (
                <span className="flex items-center gap-1.5 text-xs text-yellow-500 whitespace-nowrap">
                    <Loader size={12} className="animate-spin" />
                    Building...
                </span>
             )}
            
            <button 
                onClick={onStop}
                disabled={status === "stopping"}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded text-xs transition-colors"
                title="Stop Sandbox"
            >
                <Square size={10} fill="currentColor" />
            </button>
        </div>
      </WebPreviewNavigation>

      {viewMode === "preview" ? (
          <WebPreviewBody 
            className="bg-white"
            loading={
                status === "working" ? (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-neutral-900/90 backdrop-blur-[2px]">
                       <div className="flex flex-col items-center gap-4">
                         <div className="relative">
                            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse"></div>
                            <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center relative">
                                <Loader size={32} className="text-blue-500 animate-spin" />
                            </div>
                         </div>
                         <div className="text-center space-y-1">
                            <p className="text-sm font-medium text-neutral-300">Setting up environment</p>
                            <p className="text-xs text-neutral-500">Installing dependencies and starting server...</p>
                         </div>
                       </div>
                    </div>
                ) : undefined
            } 
           />
      ) : (
          <CodeExplorer projectId={projectId} className="flex-1 border-0 rounded-none bg-neutral-900" />
      )}
    </WebPreview>
  );
}
