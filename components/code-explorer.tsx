"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { Loader } from "@/components/ai-elements/loader";
import { cn } from "@/lib/utils";
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FileCode, 
  FileJson, 
  FileIcon,
  AlertCircle
} from "lucide-react";
import { useState, useMemo } from "react";
import type { BundledLanguage } from "shiki";

interface CodeExplorerProps {
  projectId: Id<"projects">;
  className?: string;
}

type FileNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
  content?: string;
};

export default function CodeExplorer({ projectId, className }: CodeExplorerProps) {
  const files = useQuery(api.files.getFiles, { projectId });
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Build file tree from flat paths
  const fileTree = useMemo(() => {
    if (!files) return [];

    const root: FileNode[] = [];
    const map = new Map<string, FileNode>();

    // Sort files to ensure folders come first or strictly alphabetical
    // But usually simple path sorting is enough for build, visual sorting happens later
    const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

    sortedFiles.forEach((file) => {
      const parts = file.path.split("/").filter(Boolean);
      let currentLevel = root;
      let currentPath = "";

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isFile = index === parts.length - 1;

        // Check if we already have this node at this level
        // (Note: simple "find" works because levels are small)
        let node = currentLevel.find((n) => n.name === part);

        if (!node) {
          node = {
            name: part,
            path: isFile ? file.path : currentPath, // Use exact DB path for files
            type: isFile ? "file" : "folder",
            children: isFile ? undefined : [],
            content: isFile ? file.content : undefined,
          };
          currentLevel.push(node);
        }

        if (!isFile && node.children) {
          currentLevel = node.children;
        }
      });
    });

    // Helper to sort nodes: folders first, then files, alphabetically
    const sortNodes = (nodes: FileNode[]) => {
      nodes.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === "folder" ? -1 : 1;
      });
      nodes.forEach((node) => {
        if (node.children) sortNodes(node.children);
      });
    };

    sortNodes(root);
    return root;
  }, [files]);

  const selectedFileContent = useMemo(() => {
    if (!files || !selectedFile) return null;
    return files.find(f => f.path === selectedFile)?.content;
  }, [files, selectedFile]);

  // Determine language for syntax highlighting
  const getLanguage = (filename: string): BundledLanguage => {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "ts":
      case "tsx":
        return "typescript";
      case "js":
      case "jsx":
        return "javascript";
      case "css":
        return "css";
      case "html":
        return "html";
      case "json":
        return "json";
      case "md":
        return "markdown";
      case "py":
        return "python";
      default:
        return "plaintext" as BundledLanguage;
    }
  };

  if (files === undefined) {
    return (
      <div className={cn("flex h-full items-center justify-center bg-neutral-900 border border-neutral-800 rounded-lg", className)}>
        <Loader className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (files === null || files.length === 0) {
     return (
        <div className={cn("flex flex-col h-full items-center justify-center bg-neutral-900 border border-neutral-800 rounded-lg p-6 text-center", className)}>
             <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mb-4">
                 <AlertCircle className="text-neutral-500" />
             </div>
             <p className="text-neutral-300 font-medium">No files found</p>
             <p className="text-sm text-neutral-500 mt-1">Start by asking the agent to create some code.</p>
        </div>
     )
  }

  return (
    <div className={cn("flex h-full bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden dark", className)}>
      {/* Sidebar: File Tree */}
      <div className="w-64 flex-shrink-0 border-r border-neutral-800 bg-neutral-950 flex flex-col">
        <div className="p-3 border-b border-neutral-800 bg-neutral-950/50">
           <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Explorer</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
            <FileTree 
                nodes={fileTree} 
                selectedFile={selectedFile} 
                onSelect={setSelectedFile} 
            />
        </div>
      </div>

      {/* Main: Code Viewer */}
      <div className="flex-1 flex flex-col min-w-0 bg-neutral-900">
        {selectedFile ? (
            <>
                <div className="flex items-center px-4 py-2 border-b border-neutral-800 bg-neutral-900">
                    <FileIcon className="w-4 h-4 text-neutral-400 mr-2" />
                    <span className="text-sm text-neutral-300 font-mono truncate">{selectedFile}</span>
                </div>
                <div className="flex-1 overflow-hidden relative">
                   {/* We use a div wrapper to ensure CodeBlock scrolls properly */}
                   <div className="absolute inset-0 overflow-auto custom-scrollbar">
                        <CodeBlock 
                            code={selectedFileContent || ""} 
                            language={getLanguage(selectedFile)}
                            className="min-h-full border-0 rounded-none bg-neutral-900"
                            showLineNumbers={true}
                        />
                   </div>
                </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-neutral-500">
                <FileCode size={48} strokeWidth={1} className="mb-4 opacity-20" />
                <p>Select a file to view content</p>
            </div>
        )}
      </div>
    </div>
  );
}

// Recursive File Tree Component
function FileTree({ 
    nodes, 
    selectedFile, 
    onSelect 
}: { 
    nodes: FileNode[], 
    selectedFile: string | null, 
    onSelect: (path: string) => void 
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {nodes.map((node) => (
        <FileTreeNode 
            key={node.path} 
            node={node} 
            selectedFile={selectedFile} 
            onSelect={onSelect} 
        />
      ))}
    </div>
  );
}

function FileTreeNode({ 
    node, 
    selectedFile, 
    onSelect 
}: { 
    node: FileNode, 
    selectedFile: string | null, 
    onSelect: (path: string) => void 
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  const isSelected = selectedFile === node.path;
  
  const handleClick = () => {
    if (node.type === "folder") {
      setIsOpen(!isOpen);
    } else {
      onSelect(node.path);
    }
  };

  const getIcon = () => {
      if (node.type === "folder") return <Folder size={14} className={cn("text-blue-400", isOpen && "fill-blue-400/20")} />;
      if (node.name.endsWith("json")) return <FileJson size={14} className="text-yellow-400" />;
      if (node.name.endsWith("tsx") || node.name.endsWith("ts")) return <FileCode size={14} className="text-blue-400" />;
      if (node.name.endsWith("css")) return <FileCode size={14} className="text-sky-300" />;
      return <File size={14} className="text-neutral-400" />;
  };

  return (
    <div className="select-none">
      <div 
        className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors text-sm",
            isSelected ? "bg-blue-500/10 text-blue-400" : "hover:bg-neutral-800 text-neutral-400"
        )}
        onClick={handleClick}
        style={{ paddingLeft: `${(node.path.split("/").length - 1) * 12 + 8}px` }} // Indent based on depth (rough check)
        // Better depth approach: pass depth as prop
      >
        <span className="flex-shrink-0 opacity-70">
            {node.type === "folder" && (
                isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            )}
            {node.type === "file" && <div className="w-3.5" />} {/* Spacer */}
        </span>
        
        {getIcon()}
        
        <span className="truncate">{node.name}</span>
      </div>

      {node.type === "folder" && isOpen && node.children && (
        <div>
           {/* We don't need recursive padding here because I did the cheap padding hack above based on path split.
               However, strictly speaking, a recursive render without padding wrapper is cleaner if we pass depth.
               Let's stick to the current recursion loop which just renders children.
               The padding calculation above `node.path.split("/").length` handles the indent globally.
            */}
          <FileTree nodes={node.children} selectedFile={selectedFile} onSelect={onSelect} />
        </div>
      )}
    </div>
  );
}
