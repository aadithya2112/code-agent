import { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { Sandbox } from "@e2b/code-interpreter";

export type ToolContext = {
    ctx: ActionCtx;
    projectId: Id<"projects">;
    userId: string;
    sandbox?: Sandbox;
};

export const tools = {
    read_file: async ({ ctx, projectId, userId }: ToolContext, args: any) => {
        return await ctx.runQuery(internal.files.readInternal, {
            projectId,
            path: args.path,
        });
    },

    write_file: async ({ ctx, projectId, userId }: ToolContext, args: any) => {
        await ctx.runMutation(internal.files.saveInternal, {
            projectId,
            path: args.path,
            content: args.content,
        });
        return "File saved successfully.";
    },

    list_files: async ({ ctx, projectId, userId }: ToolContext, args: any) => {
        const files = await ctx.runQuery(internal.files.getFilesInternal, {
            projectId,
        });
        return JSON.stringify(files.map((f: any) => f.path));
    },

    delete_file: async ({ ctx, projectId, userId }: ToolContext, args: any) => {
        await ctx.runMutation(internal.files.deleteFileInternal, {
            projectId,
            path: args.path,
        });
        return "File deleted successfully.";
    },

    run_code: async ({ sandbox }: ToolContext, args: any) => {
        if (!sandbox) {
            // We expect the agent to handle sandbox creation if missing, or we error
            // But realistically, the agent logic handles the 'ensure sandbox' part.
            // For this refactor, we assume sandbox is passed if needed, or we throw/create.
            // The original logic created it inside the switch. 
            // We should arguably return a request to create it, or passing the API key is needed.
            // Let's assume the caller ensures sandbox exists or provides the capability to create it.
            // Actually, best to throw specific error "SANDBOX_REQUIRED" and handle in agent.
            throw new Error("Sandbox required for run_code");
        }
        const exec = await sandbox.runCode(args.code);
        return {
            text: exec.text,
            logs: exec.logs,
            error: exec.error,
            results: exec.results, 
        };
    },

    execute_command: async ({ sandbox }: ToolContext, args: any) => {
         if (!sandbox) throw new Error("Sandbox required for execute_command");
         
         const cmdResult = await sandbox.runCode(`
import subprocess
result = subprocess.run(${JSON.stringify(args.command)}, shell=True, capture_output=True, text=True)
print(f"STDOUT:\\n{result.stdout}")
print(f"STDERR:\\n{result.stderr}")
print(f"EXIT_CODE: {result.returncode}")
`);
        return {
            stdout: cmdResult.text,
            logs: cmdResult.logs,
            error: cmdResult.error,
        };
    },

    search_files: async ({ ctx, projectId }: ToolContext, args: any) => {
        const allFiles = await ctx.runQuery(internal.files.getFilesInternal, {
            projectId,
        });
        
        const matches: any[] = [];
        const pattern = args.pattern;
        const filePattern = args.file_pattern;
        
        for (const file of allFiles) {
            if (filePattern && !file.path.match(filePattern.replace('*', '.*'))) {
                continue;
            }
            
            const lines = file.content.split('\n');
            lines.forEach((line: string, index: number) => {
                if (line.includes(pattern)) {
                    matches.push({
                        file: file.path,
                        line: index + 1,
                        content: line.trim()
                    });
                }
            });
        }
        
        return matches.length > 0 
            ? `Found ${matches.length} matches:\n${matches.slice(0, 20).map(m => `${m.file}:${m.line} - ${m.content}`).join('\n')}${matches.length > 20 ? `\n... and ${matches.length - 20} more` : ''}`
            : "No matches found.";
    },

    patch_file: async ({ ctx, projectId }: ToolContext, args: any) => {
        const fileContent = await ctx.runQuery(internal.files.readInternal, {
            projectId,
            path: args.path,
        });
        
        if (!fileContent) {
            return `Error: File ${args.path} not found.`;
        }
        
        if (!fileContent.includes(args.old_content)) {
            return `Error: Could not find the specified content to replace in ${args.path}. The content may have already been changed or the match is not exact.`;
        }
        
        const patchedContent = fileContent.replace(args.old_content, args.new_content);
        
        await ctx.runMutation(internal.files.saveInternal, {
            projectId,
            path: args.path,
            content: patchedContent,
        });
        
        return `Successfully patched ${args.path}`;
    }
};
