"use client";

import { useState, useEffect } from "react";
import { Send, Sparkles, AlertCircle } from "lucide-react";

interface ChatInterfaceProps {
  onInitialize: (prompt: string) => void;
  isInitializing: boolean;
  hasActiveSandbox: boolean;
}

export default function ChatInterface({ onInitialize, isInitializing, hasActiveSandbox }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
        setMessages([{
            role: "assistant",
            content: "Hello! Describe the app you want to build (e.g., 'A simple React todo list' or 'A Next.js dashboard with API')."
        }]);
    }
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading || isInitializing) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // If no sandbox is active, treat this as the initialization prompt
    if (!hasActiveSandbox) {
        onInitialize(userMessage.content);
        return;
    }

    // Normal chat logic (future use for editing/agent)
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          // sandboxID would be passed here if we had it in props or handled in context
          // For now, we are in "manual mode" mostly, but chat expects it.
          // We'll skip detailed agent chat logic for this specific refactor step 
          // as the user focus is on the "Workflow" of initialization.
        }),
      });

      const data = await res.json();
      
      if (data.error) {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${data.error}` }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { role: "assistant", content: "Failed to send message." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900 text-white rounded-lg border border-neutral-800 overflow-hidden shadow-lg">
       {/* Header */}
       <div className="p-3 bg-neutral-950 border-b border-neutral-800 flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-400">AI Assistant</span>
            {hasActiveSandbox && <span className="w-2 h-2 rounded-full bg-green-500" title="Active Sandbox"></span>}
       </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-lg text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-blue-600/90 text-white shadow-md"
                  : "bg-neutral-800 text-neutral-200"
              }`}
            >
              <pre className="whitespace-pre-wrap font-sans font-medium">{m.content}</pre>
            </div>
          </div>
        ))}
        {(loading || isInitializing) && (
          <div className="flex justify-start">
            <div className="max-w-[85%] p-3 rounded-lg text-sm bg-neutral-800 text-neutral-200 animate-pulse flex items-center gap-2">
              <Sparkles size={14} className="text-blue-400" />
              {isInitializing ? "Setting up your environment..." : "Thinking..."}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-neutral-950 border-t border-neutral-800">
        <div className="flex items-center gap-2 bg-neutral-800/50 border border-neutral-800 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-transparent transition-all">
          <input
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-neutral-500 text-sm"
            placeholder={hasActiveSandbox ? "Ask to make changes..." : "Describe an app to start..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            disabled={loading || isInitializing}
          />
          <button
            onClick={sendMessage}
            disabled={loading || isInitializing || !input.trim()}
            className="p-1.5 hover:bg-blue-600/20 text-neutral-400 hover:text-blue-400 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
