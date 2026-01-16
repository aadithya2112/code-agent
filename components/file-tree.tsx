"use client";

import { useState } from "react";
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FileCode, 
  FileJson,
  FileIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

export type FileNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
  content?: string;
};

interface FileTreeProps {
    nodes: FileNode[];
    selectedFile: string | null;
    onSelect: (path: string) => void;
}

export function FileTree({ 
    nodes, 
    selectedFile, 
    onSelect 
}: FileTreeProps) {
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
        style={{ paddingLeft: `${(node.path.split("/").length - 1) * 12 + 8}px` }}
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
          <FileTree nodes={node.children} selectedFile={selectedFile} onSelect={onSelect} />
        </div>
      )}
    </div>
  );
}
