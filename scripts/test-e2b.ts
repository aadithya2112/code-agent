import { Sandbox } from "@e2b/code-interpreter";
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  console.log("Starting manual E2B test...");
  
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    console.error("Error: E2B_API_KEY not found in .env");
    process.exit(1);
  }

  try {
    console.log("Creating sandbox...");
    const sandbox = await Sandbox.create({
        apiKey: apiKey
    });
    console.log(`Sandbox created: ${sandbox.sandboxId}`);

    // Using a standard vite template for speed and reliability, or the user's requested one if specific.
    // User asked for "Clone the same react template". Existing script had code-agent-react-starter.
    // I will use `npm create vite@latest my-vue-app -- --template react` type approach which is faster than cloning sometimes,
    // BUT the user specifically said "Clone the same react template". So I will stick to git clone.
    const repoUrl = "https://github.com/aadithya2112/code-agent-react-starter.git"; 
    const dirName = "code-agent-react-starter";

    console.log(`Cloning repo ${repoUrl}...`);
    await sandbox.commands.run(`git clone ${repoUrl}`);
    console.log("Repo cloned.");

    // Install Bun
    console.log("Installing Bun...");
    // We use npm to install bun globally for convenience as it's likely pre-installed or standard way in node containers
    // Alternatively: curl -fsSL https://bun.sh/install | bash
    // Let's try the curl method as it's robust for Linux environments usually found in E2B
    await sandbox.commands.run("curl -fsSL https://bun.sh/install | bash");
    // Bun installs to /home/user/.bun/bin usually. We need to make sure it's in path or call explicitly.
    // The E2B sandbox user is usually 'user'.
    const bunPath = "/home/user/.bun/bin/bun";
    console.log("Bun installed.");

    console.log("Installing dependencies with Bun...");
    // We use the full path to bun to be safe, or we could update PATH. 
    // "source /home/user/.bashrc" might not persist across execs depending on shell.
    // simpler to just call the binary.
    const install = await sandbox.commands.run(`cd ${dirName} && ${bunPath} install`);
    if (install.exitCode !== 0) {
        console.error("Install failed:", install.stderr);
        // Fallback to npm if bun fails? No, user requested bun.
        throw new Error("Install failed");
    }
    console.log("Install finished.");

    console.log("Configuring Vite allowed hosts...");
    // Attempt to modify vite.config.ts or vite.config.js to allow all hosts
    // We inject `server: { allowedHosts: true, host: true },` at the start of defineConfig
    // Note: allowedHosts: true might be Vite 5.1+ feature.
    await sandbox.commands.run(`cd ${dirName} && sed -i 's/defineConfig({/defineConfig({ server: { allowedHosts: true, host: true },/' vite.config.ts || true`);
    await sandbox.commands.run(`cd ${dirName} && sed -i 's/defineConfig({/defineConfig({ server: { allowedHosts: true, host: true },/' vite.config.js || true`);

    console.log("Starting server with Bun...");
    // Start server in background
    // Removed invalid CLI flag --allowed-hosts
    const dev = await sandbox.commands.run(`cd ${dirName} && ${bunPath} run dev`, { 
        background: true,
        onStdout: (text) => console.log(`[SB_STDOUT] ${text}`),
        onStderr: (text) => console.error(`[SB_STDERR] ${text}`)
    });
    console.log(`Server started with PID: ${dev.pid}`);

    // Wait for a bit for the server to spin up. 
    console.log("Waiting 3 seconds for server to bind...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try to curl localhost inside the sandbox to verify it's running
    // Vite with Bun might default to 5173
    const ports = [5173, 3000, 3001];
    let workingPort = 0;

    for (const port of ports) {
        console.log(`Checking internal connectivity on port ${port}...`);
        const result = await sandbox.commands.run(`curl -I http://localhost:${port}`);
        console.log(`Curl exit code: ${result.exitCode}`);
        if (result.exitCode === 0) {
            console.log(`Internal curl successful on port ${port}!`);
            workingPort = port;
            break;
        }
    }

    if (workingPort === 0) {
        console.error("Could not connect to server internally on ports 5173 or 3000.");
        // We might fail here, but let's try external access anyway just in case.
    }

    // Fix 403 error by allowing all hosts in Vite
    // We can pass --allowed-hosts all to vite if supported, or edit vite.config.
    // Vite 5.1+ supports --allowed-hosts check? actually let's try editing the config or just checking if that's the issue.
    // The previous 403 might also be because of the path.
    // Let's try to pass --host 0.0.0.0 explicitly and maybe disable host check if possible.
    // But first, let's keep the sandbox alive.

    if (workingPort) {
        // Get public URL
        const host = sandbox.getHost(workingPort);
        const url = `https://${host}`;
        console.log(`\n>>> Server accessible at: ${url} <<<\n`);
        
        console.log("Verifying external access via curl...");
        try {
            const response = await fetch(url);
            console.log(`External Request Status: ${response.status}`);
            if (response.ok) {
                console.log("SUCCESS: External access verified.");
                const text = await response.text();
                console.log(`Content preview: ${text.substring(0, 100)}...`);
            } else {
                console.error("FAILURE: External access returned error status.");
            }
        } catch (e) {
            console.error("FAILURE: External access threw error:", e);
        }
    }

    console.log("\nTest Finished. Sandbox is still running.");
    console.log(`Sandbox ID: ${sandbox.sandboxId}`);
    console.log("Press Ctrl+C to exit and kill the sandbox (or wait for timeout).");

    // Keep process alive to stream logs
    await new Promise(() => {});

  } catch (err) {
    console.error("Error running test:", err);
  }
}

main();
