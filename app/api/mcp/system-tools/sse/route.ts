import { NextRequest } from "next/server";
import { mcpServer, transportMap } from "@/lib/mcp/server";
import { WebSSETransport } from "@/lib/mcp/transport";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId") || crypto.randomUUID();
  
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  
  const transport = new WebSSETransport(writer, sessionId);

  await mcpServer.connect(transport);
  transportMap.set(sessionId, transport);

  // Start the transport (sends endpoint event)
  // We don't await because it might block? No, start() just sends initial event.
  await transport.start();

  req.signal.addEventListener("abort", () => {
    transportMap.delete(sessionId);
    transport.close();
  });

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}