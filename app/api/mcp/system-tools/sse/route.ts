import { NextRequest } from "next/server";
import { mcpServer, transportMap } from "@/lib/mcp/server";
import { WebSSETransport } from "@/lib/mcp/transport";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const sessionId = req.nextUrl.searchParams.get("sessionId") || crypto.randomUUID();
  
  console.log(`[MCP SSE] Connection request: ${sessionId} (Origin: ${origin})`);
  
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const transport = new WebSSETransport(writer, sessionId, origin);

  // Setup abort handler before starting
  // Note: We delay session cleanup to allow any pending POST requests to complete
  req.signal.addEventListener("abort", () => {
    console.log(`[MCP SSE] Connection closed (aborted): ${sessionId}`);
    // Keep session for 5 seconds after abort to handle any pending messages
    setTimeout(() => {
      console.log(`[MCP SSE] Cleaning up session after grace period: ${sessionId}`);
      transportMap.delete(sessionId);
      transport.close();
    }, 5000);
  });

  // Connect and start in background to avoid blocking the initial Response return
  // This ensures Next.js starts the stream immediately
  (async () => {
    try {
      console.log(`[MCP SSE] Connecting transport for: ${sessionId}`);
      await mcpServer.connect(transport);
      console.log(`[MCP SSE] Connected, registering session: ${sessionId}`);
      transportMap.set(sessionId, transport);
      console.log(`[MCP SSE] Session registered, transportMap size: ${transportMap.size}`);
      await transport.start();
      console.log(`[MCP SSE] Handshake complete: ${sessionId}`);
    } catch (err) {
      console.error(`[MCP SSE] Handshake failed for ${sessionId}:`, err);
      try { writer.close(); } catch {}
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx/proxy buffering
    },
  });
}
