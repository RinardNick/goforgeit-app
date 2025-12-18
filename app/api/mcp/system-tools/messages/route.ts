import { NextRequest, NextResponse } from "next/server";
import { transportMap } from "@/lib/mcp/server";

export async function POST(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const transport = transportMap.get(sessionId);

  if (!transport) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  try {
    const message = await req.json();
    
    // Bypass handlePostMessage's Node.js req/res dependency
    // Directly inject the parsed JSON message into the transport
    // @ts-ignore - Accessing protected/internal method if necessary, or public
    await transport.handleMessage(message);
    
    return new NextResponse("Accepted", { status: 202 });
  } catch (err) {
    console.error("MCP Message error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
