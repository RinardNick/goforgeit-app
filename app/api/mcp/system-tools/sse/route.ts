import { NextRequest } from "next/server";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { mcpServer, transportMap } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  
  const transport = new SSEServerTransport(
    "/api/mcp/system-tools/messages", 
    sessionId || undefined
  );

  await mcpServer.connect(transport);
  transportMap.set(transport.sessionId, transport);

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Adapter to make Node-centric SDK work with Web Streams
  const resAdapter = {
    headersSent: false,
    statusCode: 200,
    setHeader: () => {},
    writeHead: () => {},
    write: (chunk: string) => {
      writer.write(encoder.encode(chunk));
      return true;
    },
    end: () => {
      writer.close();
      transportMap.delete(transport.sessionId);
    },
    on: () => {},
    once: () => {},
    emit: () => {},
    removeListener: () => {},
  };

  // Start the transport (this sends the initial 'endpoint' event)
  // We mock the request object as it's not strictly used by start() except for query parsing which we handled
  transport.start({} as any, resAdapter as any).catch(err => {
    console.error("MCP Transport error:", err);
    writer.abort(err);
  });

  req.signal.addEventListener("abort", () => {
    transportMap.delete(transport.sessionId);
    // writer.close(); // Handled by stream
  });

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
