import { NextRequest, NextResponse } from "next/server";
import { createSandbox, runAgent } from "@/lib/agent";
import { Sandbox } from "@e2b/code-interpreter";

// We need to store the sandbox ID somewhere to reuse it.
// For this simple prototype, we'll create a new sandbox for each request 
// IF the client doesn't provide one. Realistically, we should persist this.
// But for now, let's keep it per-session in memory won't work serverless.
// We'll trust the client to pass the sandboxID if they have one? 
// No, E2B keeps sandboxes alive. We just need the ID.

export async function POST(req: NextRequest) {
  try {
    const { messages, sandboxID, projectId } = await req.json();

    let sandbox;
    let newSandboxID = sandboxID;

    if (sandboxID) {
      try {
        sandbox = await Sandbox.connect(sandboxID);
      } catch (e) {
        console.log("Failed to connect to existing sandbox, creating new one.");
        sandbox = await createSandbox();
        newSandboxID = sandbox.sandboxId;
      }
    } else {
      sandbox = await createSandbox();
      newSandboxID = sandbox.sandboxId;
    }

    // Set a timeout or keep alive? E2B defaults to 5 mins default.
    // We'll keep it alive for 30 mins for the user session.
    // We'll trust the sandbox default timeout for now.
    // await sandbox.keepAlive(30 * 60 * 1000); 

    const responseContent = await runAgent(messages, sandbox, projectId);

    // Return the response, and also the sandboxID so the client can reuse it.
    // Also we might want to return the URL of the running app?
    // Using E2B's formatting: https://<port>-<sandbox-id>.e2b.dev
    // But we don't know the port yet (usually 3000).

    return NextResponse.json({
      content: responseContent,
      sandboxID: newSandboxID,
    });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
