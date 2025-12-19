import { NextRequest, NextResponse } from "next/server";
import { transportMap } from "@/lib/mcp/server";

export async function POST(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  console.log(`[MCP Messages] Looking for session: ${sessionId}`);
  console.log(`[MCP Messages] transportMap has ${transportMap.size} sessions: ${Array.from(transportMap.keys()).join(', ')}`);

  const transport = transportMap.get(sessionId);

  if (!transport) {
    console.log(`[MCP Messages] Session not found: ${sessionId}`);
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  try {
    const message = await req.json();
    await transport.handleMessage(message);
    return new NextResponse("Accepted", { status: 202 });
  } catch (err) {
    console.error("MCP Message error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}