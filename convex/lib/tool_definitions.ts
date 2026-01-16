export const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file from the project filesystem. Use this to examine existing code, configuration files, or any project file before making changes. Always list files first if you're unsure what exists.",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "The relative path of the file to read (e.g., 'src/App.tsx', 'package.json', 'components/Button.tsx')" 
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create a new file or completely overwrite an existing file with new content. Use this to implement features, fix bugs, or create new components. The file will be created with all necessary parent directories.",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "The relative path where the file should be written (e.g., 'src/components/NewComponent.tsx', 'styles/custom.css')" 
          },
          content: { 
            type: "string", 
            description: "The complete content to write to the file. Include all necessary imports, code, and proper formatting." 
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List all files currently in the project filesystem. Use this to understand the project structure, find existing components, or verify what files exist before reading or modifying them. Always call this before making assumptions about file locations.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Permanently delete a file from the project. Use this to remove unused components, clean up old files, or remove temporary files. Be careful as this action cannot be undone.",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "The relative path of the file to delete (e.g., 'src/components/OldComponent.tsx')" 
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_code",
      description: "Execute Python code in an isolated sandbox environment. Use this to: test algorithms, perform calculations, process data, validate logic, or run utility scripts. The environment persists across calls within the same conversation, so you can define functions and reuse them. Cannot access project files directly - use file tools for that.",
      parameters: {
        type: "object",
        properties: {
          code: { 
            type: "string", 
            description: "The Python code to execute. Can include imports, function definitions, and print statements. Output will be captured and returned." 
          },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_command",
      description: "Execute a shell command in the project directory. Use this to: install packages (npm/bun), run build scripts, execute tests, or run any CLI command. Commands run in an isolated environment. Essential for package management and project operations.",
      parameters: {
        type: "object",
        properties: {
          command: { 
            type: "string", 
            description: "The shell command to execute (e.g., 'bun add zustand', 'npm run build', 'npm test')" 
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Search for a text pattern across all project files. Use this to: find where a component/function is used, locate specific code patterns, discover imports, or find TODO comments. Returns matching files with line numbers and context.",
      parameters: {
        type: "object",
        properties: {
          pattern: { 
            type: "string", 
            description: "The text pattern to search for (e.g., 'import Button', 'useState', 'TODO'). Case-sensitive." 
          },
          file_pattern: {
            type: "string",
            description: "Optional: Filter by file pattern (e.g., '*.tsx', '*.ts'). If omitted, searches all files."
          }
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "patch_file",
      description: "Make a targeted edit to a specific section of a file without rewriting the entire file. More efficient than write_file for small changes. Finds the old_content in the file and replaces it with new_content. Use this for: changing a single function, updating imports, modifying specific lines, or fixing bugs in isolated sections.",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "The relative path of the file to patch (e.g., 'src/App.tsx')" 
          },
          old_content: {
            type: "string",
            description: "The exact content to replace. Must match the file content precisely, including whitespace and indentation."
          },
          new_content: {
            type: "string",
            description: "The new content to insert in place of old_content."
          }
        },
        required: ["path", "old_content", "new_content"],
      },
    },
  },
];
