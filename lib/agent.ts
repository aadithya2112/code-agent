import { OpenAI } from "openai";
import { Sandbox } from "@e2b/code-interpreter";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const MODEL = "deepseek/deepseek-chat";

export type ToolResult = {
  toolCallId: string;
  output: string;
};

// Tool Definitions
const tools = [
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or update a file in the sandbox. Use this to create the application code.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "The path to the file, e.g., 'src/App.tsx'" },
          content: { type: "string", description: "The content of the file." },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Run a shell command in the sandbox. Use this to install dependencies or start the dev server.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The command to run, e.g., 'npm install'" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_server",
      description: "Start a long-running server (e.g., npm run dev) in the background. Use this to run the application.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The command to run, e.g., 'npm run dev'" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files in a directory.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "The directory path to list." },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the content of a file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "The path to the file." },
        },
        required: ["path"],
      },
    },
  },
] as const;

export async function createSandbox() {
  return await Sandbox.create();
}

export async function runAgent(messages: any[], sandbox: Sandbox) {
  let currentMessages = [...messages];
  
  // Max turns to prevent infinite loops
  const MAX_TURNS = 10;
  
  for (let i = 0; i < MAX_TURNS; i++) {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: currentMessages,
      tools: tools as any,
      tool_choice: "auto",
    }) as any;

    const choice = response.choices[0];
    const message = choice.message;
    
    currentMessages.push(message);

    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log(`[Agent] Executing ${message.tool_calls.length} tools...`);
      
      for (const toolCall of message.tool_calls) {
        console.log(`[Agent] Tool Call: ${toolCall.function.name}`, toolCall.function.arguments);
        let result = "";
        
        try {
          const args = JSON.parse(toolCall.function.arguments);
          
            if (toolCall.function.name === "write_file") {
            const dir = args.path.substring(0, args.path.lastIndexOf('/'));
            if (dir) {
                await sandbox.files.makeDir(dir);
            }
            await sandbox.files.write(args.path, args.content);
            result = `File ${args.path} written successfully.`;

          } else if (toolCall.function.name === "run_command") {
            console.log(`[Agent] Running command: ${args.command}`);
            const exec = await sandbox.commands.run(args.command);
            console.log(`[Agent] Command finished. Exit code: ${exec.exitCode}`);
            if (exec.stdout) console.log(`[Agent] Stdout: ${exec.stdout}`);
            if (exec.stderr) console.log(`[Agent] Stderr: ${exec.stderr}`);
            result = `Command executed.\nStdout: ${exec.stdout}\nStderr: ${exec.stderr}`;
          } else if (toolCall.function.name === "start_server") {
            console.log(`[Agent] Starting server: ${args.command}`);
            const exec = await sandbox.commands.run(args.command, { background: true });
            console.log(`[Agent] Server started. Pid: ${exec.pid}`);
            result = `Server started in background. Pid: ${exec.pid}`;
          } else if (toolCall.function.name === "list_files") {
            const files = await sandbox.files.list(args.path);
            result = JSON.stringify(files.map((f: any) => f.name));
          } else if (toolCall.function.name === "read_file") {
            result = await sandbox.files.read(args.path);
          }
        } catch (e: any) {
          console.error(`[Agent] Tool execution error:`, e);
          result = `Error executing tool: ${e.message}`;
        }

        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }
    } else {
      // No tools called, return the final response
      return message.content;
    }
  }
  
  return "Agent stopped after maximum turns.";
}
