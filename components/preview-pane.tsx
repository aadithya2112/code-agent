"use client";

import { RefreshCw, ExternalLink, Square, Loader2, Globe } from "lucide-react";
import { useState, useEffect } from "react";

interface PreviewPaneProps {
  sandboxID: string | null;
  port: number;
  projectType: "react" | "nextjs" | null;
  status: "idle" | "working" | "ready" | "stopping";
  onStop: () => void;
}

export default function PreviewPane({ sandboxID, port, projectType, status, onStop }: PreviewPaneProps) {
  const [localPort, setLocalPort] = useState(port);
  const [key, setKey] = useState(0); // to force refresh

  // Sync prop port to local state when it changes (e.g. after init)
  useEffect(() => {
    if (port) setLocalPort(port);
  }, [port]);

  const url = sandboxID && status === "ready"
    ? `https://${localPort}-${sandboxID}.e2b.app` 
    : null;

  return (
    <div className="flex flex-col h-full bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden shadow-lg relative">
        {/* Background Grid Pattern for Empty State */}
        {!url && (
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
                 style={{ 
                     backgroundImage: 'radial-gradient(circle at 1px 1px, #404040 1px, transparent 0)', 
                     backgroundSize: '20px 20px' 
                 }} 
            />
        )}

      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-neutral-950/80 backdrop-blur-sm border-b border-neutral-800 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
              <Globe size={14} className="text-neutral-400" />
              <span className="text-sm font-medium text-neutral-300">Preview</span>
          </div>
          
          {status === "ready" && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20">
              LIVE
            </span>
          )}
          
          {projectType && (
             <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 capitalize">
                {projectType === 'nextjs' ? 'Next.js' : 'React'}
             </span>
          )}

          {status === "working" && (
             <span className="flex items-center gap-1.5 text-xs text-yellow-500">
                <Loader2 size={12} className="animate-spin" />
                <span className="opacity-80">Building...</span>
             </span>
          )}
        </div>

        <div className="flex items-center gap-2">
            {status !== "idle" && (
                <button 
                    onClick={onStop}
                    disabled={status === "stopping"}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded text-xs transition-colors"
                >
                    <Square size={10} fill="currentColor" />
                    Stop
                </button>
            )}

            {url && (
                <>
                  <div className="h-4 w-px bg-neutral-800 mx-1" />
                  
                  <input 
                    className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs w-16 text-center text-neutral-400 focus:text-white outline-none focus:border-neutral-700 transition-colors"
                    value={localPort}
                    onChange={(e) => setLocalPort(Number(e.target.value))}
                    title="Port"
                  />
                  
                  <button 
                    onClick={() => setKey(k => k + 1)}
                    className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw size={14} />
                  </button>
                  
                  <a 
                    href={url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors"
                  >
                    <ExternalLink size={14} />
                  </a>
                </>
            )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 relative z-10 bg-transparent flex flex-col">
        {url ? (
          <iframe 
            key={key}
            src={url}
            className="w-full h-full border-none bg-white"
            title="Preview"
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-500">
            {status === "working" ? (
                <div className="flex flex-col items-center gap-4">
                     <div className="relative">
                        <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse"></div>
                        <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center relative">
                            <Loader2 size={32} className="text-blue-500 animate-spin" />
                        </div>
                     </div>
                     <div className="text-center space-y-1">
                        <p className="text-sm font-medium text-neutral-300">Setting up environment</p>
                        <p className="text-xs text-neutral-500">Installing dependencies and starting server...</p>
                     </div>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-3 opacity-60">
                   <div className="w-16 h-16 rounded-2xl bg-neutral-900/50 border border-neutral-800/50 flex items-center justify-center rotate-3 transform transition-transform hover:rotate-6">
                        <Globe size={32} className="text-neutral-700" />
                   </div>
                   <p className="text-sm text-neutral-600 font-medium tracking-wide">PREVIEW AREA</p>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
