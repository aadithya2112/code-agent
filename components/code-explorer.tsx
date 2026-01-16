"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader } from "@/components/ai-elements/loader";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Save,
  FileCode,
  FileIcon
} from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import Editor, { useMonaco, type Monaco } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { FileTree, type FileNode } from "@/components/file-tree";

interface CodeExplorerProps {
  projectId: Id<"projects">;
  sandboxID: string | null;
  className?: string;
}


export default function CodeExplorer({ projectId, sandboxID, className }: CodeExplorerProps) {
  const files = useQuery(api.files.getFiles, { projectId });
  const saveAndSync = useAction(api.editor.saveAndSync);
  
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Track dirty state
  const isDirty = editorContent !== originalContent;

  // Build file tree from flat paths
  const fileTree = useMemo(() => {
    if (!files) return [];

    const root: FileNode[] = [];
    const map = new Map<string, FileNode>();

    // Sort files to ensure folders come first or strictly alphabetical
    // But usually simple path sorting is enough for build, visual sorting happens later
    
    // Normalize paths: Remove leading slashes
    const normalizedFiles = files.reduce((acc, file) => {
        const cleanPath = file.path.replace(/^\/+/, '');
        // If duplicate, overwrite (assuming last in list is newer or just arbitrary? 
        // Real fix is in DB, but this fixes UI. 
        // Ideally we sort by creation time if available to pick newest, but files order isn't guaranteed)
        acc.set(cleanPath, { ...file, path: cleanPath });
        return acc;
    }, new Map<string, typeof files[0]>());

    const sortedFiles = Array.from(normalizedFiles.values()).sort((a, b) => a.path.localeCompare(b.path));

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

  // Update content when file selection changes
  // WARNING: If user has unsaved changes, we should warn them.
  // For now, we'll just overwrite. Ideally we ask for confirmation.
  // Keyboard shortcut for save
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 's') {
              e.preventDefault();
              if (isDirty) {
                  handleSave();
              }
          }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, selectedFile, editorContent, sandboxID]); // Dep list needs to be correct for handleSave closure access if not using ref

  // Determine language for syntax highlighting
  const getLanguage = (filename: string) => {
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
        return "plaintext";
    }
  };

  // Disable validation since we don't have full project context in the browser editor
  const handleEditorDidMount = (editor: any, monaco: any) => {
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });
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

  // Detect remote changes
  const remoteContent = files?.find(f => f.path === selectedFile)?.content;
  const hasRemoteChange = remoteContent !== undefined && remoteContent !== originalContent;

  useEffect(() => {
    if (remoteContent !== undefined && remoteContent !== originalContent) {
        // Auto-update if clean
        if (!isDirty) {
             console.log("Auto-updating content from server");
             setOriginalContent(remoteContent);
             setEditorContent(remoteContent);
        }
    }
  }, [remoteContent, originalContent, isDirty]);

  const handleApplyRemote = () => {
      if (remoteContent !== undefined) {
          setOriginalContent(remoteContent);
          setEditorContent(remoteContent);
      }
  };

  const handleFileSelect = (path: string) => {
      if (isDirty) {
          if (!confirm("You have unsaved changes. Discard them?")) return;
      }
      setSelectedFile(path);
      const file = files?.find(f => f.path === path);
      if (file) {
          setEditorContent(file.content);
          setOriginalContent(file.content);
      }
  };

  const handleSave = async () => {
      if (!selectedFile) return;
      
      setIsSaving(true);
      try {
          await saveAndSync({
              projectId,
              path: selectedFile,
              content: editorContent,
              sandboxID: sandboxID || undefined
          });
          setOriginalContent(editorContent);
          setLastSaved(new Date());
      } catch (error) {
          console.error("Failed to save:", error);
          // TODO: Show toast
      } finally {
          setIsSaving(false);
      }
  };

  // Keyboard shortcut for save
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 's') {
              e.preventDefault();
              if (isDirty) {
                  handleSave();
              }
          }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, selectedFile, editorContent, sandboxID]);

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
                onSelect={handleFileSelect} 
            />
        </div>
      </div>

      {/* Main: Code Editor */}
      <div className="flex-1 flex flex-col min-w-0 bg-neutral-900">
        {selectedFile ? (
            <>
                <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 bg-neutral-900 h-10">
                    <div className="flex items-center">
                        <FileIcon className="w-4 h-4 text-neutral-400 mr-2" />
                        <span className="text-sm text-neutral-300 font-mono truncate">{selectedFile}</span>
                        {isDirty && <span className="ml-2 w-2 h-2 rounded-full bg-yellow-500" title="Unsaved changes" />}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {isSaving ? (
                            <span className="text-xs text-neutral-500 animate-pulse">Saving...</span>
                        ) : lastSaved && !isDirty ? (
                            <span className="text-xs text-neutral-600">Saved</span>
                        ) : null}
                    </div>
                </div>
                
                {/* Remote Change Banner */}
                {hasRemoteChange && isDirty && (
                    <div className="bg-blue-900/30 border-b border-blue-500/20 px-4 py-2 flex items-center justify-between">
                        <span className="text-xs text-blue-200">
                            Updates available from server.
                        </span>
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 text-xs text-blue-300 hover:text-white hover:bg-blue-500/20"
                            onClick={handleApplyRemote}
                        >
                            Overwrite with Remote Logic
                        </Button>
                    </div>
                )}

                <div className="flex-1 overflow-hidden relative">
                    <Editor
                        height="100%"
                        language={getLanguage(selectedFile)}
                        value={editorContent}
                        onChange={(value) => setEditorContent(value || "")}
                        onMount={handleEditorDidMount}
                        theme="vs-dark"
                        options={{
                            minimap: { enabled: false },
                            fontSize: 13,
                            fontFamily: "Geist Mono, monospace",
                            scrollBeyondLastLine: false,
                            padding: { top: 16, bottom: 16 },
                        }}
                    />
                    
                    {/* Floating Save Button (visible when dirty) */}
                    {isDirty && (
                        <div className="absolute bottom-6 right-6 z-10">
                           <Button 
                                onClick={handleSave} 
                                size="sm" 
                                className="shadow-lg bg-blue-600 hover:bg-blue-500 text-white"
                                disabled={isSaving}
                           >
                               {isSaving ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                               Save and Run
                           </Button>
                        </div>
                    )}
                </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-neutral-500">
                <FileCode size={48} strokeWidth={1} className="mb-4 opacity-20" />
                <p>Select a file to edit</p>
            </div>
        )}
      </div>
    </div>
  );
}

