import { useState, useEffect, useRef } from "react";
import { Sparkles, Send } from "lucide-react";
import { 
  PromptInput, 
  PromptInputTextarea, 
  PromptInputSubmit
} from "@/components/ai-elements/prompt-input";
import { Message, MessageResponse } from "@/components/ai-elements/message";
import { Loader } from "@/components/ai-elements/loader";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Id } from "@/convex/_generated/dataModel";

interface ChatInterfaceProps {
  onInitialize: (prompt: string) => void;
  isInitializing: boolean;
  hasActiveSandbox: boolean;
  projectId: Id<"projects">;
}

export default function ChatInterface({ 
    onInitialize, 
    isInitializing, 
    hasActiveSandbox,
    projectId
}: ChatInterfaceProps) {
  // Queries
  const messages = useQuery(api.messages.list, { projectId }) || [];
  
  // Mutations
  const sendMessage = useMutation(api.messages.send);

  const [input, setInput] = useState("");
  // Derived state for "Thinking"
  const lastMessage = messages?.[messages.length - 1];
  // Thinking if there is an active sandbox AND the last message is NOT a final assistant completion
  // (User just spoke OR we are seeing system logs)
  const isThinking = hasActiveSandbox && lastMessage?.role !== "assistant";

  // Auto-scroll to bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, isInitializing]);

  const handleSubmit = async (value: string) => {
      // ... (no changes here)
      if (!value.trim() || isThinking || isInitializing) return;
      
      const userContent = value;
      setInput(""); 
      
      try {
          await sendMessage({ 
              projectId, 
              role: "user", 
              content: userContent 
          });

          if (!hasActiveSandbox) {
              onInitialize(userContent);
          } 
          
      } catch (error) {
        console.error(error);
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
        {messages.length === 0 && !isInitializing && !hasActiveSandbox && (
             <Message from="assistant">
                <MessageResponse>
                    Hello! Describe the app you want to build (e.g., 'A simple React todo list' or 'A Next.js dashboard with API').
                </MessageResponse>
             </Message>
        )}
        
        {messages.map((m) => {
          if (m.role === "system") {
              const toolCall = m.toolCall;
              if (!toolCall) return null; // Should not happen for system role

              const isComplete = !!toolCall.result;
              const isError = toolCall.result?.startsWith("Error:");

              return (
                 <Message key={m._id} from="assistant">
                 <Tool defaultOpen={!isComplete}>
                    <ToolHeader 
                        type="tool-call" // Or generic string
                        title={toolCall.name}
                        state={isError ? "output-error" : isComplete ? "output-available" : "input-available"}
                    />
                    <ToolContent>
                        <ToolInput input={toolCall.args} />
                        {isComplete && (
                            <ToolOutput 
                                output={toolCall.result} 
                                errorText={isError ? toolCall.result : undefined}
                            />
                        )}
                    </ToolContent>
                 </Tool>
                 </Message>
              )
          }
          return (
          <Message 
            key={m._id} 
            from={m.role === "user" ? "user" : "assistant"}
            className="" // Let component handle layout
          >
             <MessageResponse>
                {m.content}
             </MessageResponse>
          </Message>
          );
        })}
        
        {/* Loading Indicators */}
        {(isThinking || isInitializing) && (
           <Message from="assistant">
              <div className="flex items-center gap-2 text-neutral-400 text-sm py-2">
                 <Loader size={16} />
                 <span>{isInitializing ? "Setting up your environment..." : "Thinking..."}</span>
              </div>
           </Message>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-neutral-950 border-t border-neutral-800">
        <PromptInput
            onSubmit={(val) => handleSubmit(val.text)}
            className="[&_[data-slot=input-group]]:!bg-neutral-900 [&_[data-slot=input-group]]:border-neutral-800"
        >
            <PromptInputTextarea 
                placeholder={hasActiveSandbox ? "Ask to make changes..." : "Describe an app to start..."}
                className="min-h-[60px]"
                disabled={isThinking || isInitializing}
            />
            <div className="flex justify-end p-2 border-t border-neutral-800">
                <PromptInputSubmit disabled={isThinking || isInitializing}>
                    <Send className="size-4" />
                </PromptInputSubmit>
            </div>
        </PromptInput>
      </div>
    </div>
  );
}
