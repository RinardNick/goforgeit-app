import { NextApiRequest, NextApiResponse } from "next";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { mcpServer, transportMap } from "@/lib/mcp/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  // console.log("New MCP SSE connection...");

  const transport = new SSEServerTransport(
    "/api/mcp/system-tools/messages",
    res
  );

  await mcpServer.connect(transport);

  // Store transport in global map for the POST handler
  // Note: This relies on the process being stateful (not serverless lambda)
  transportMap.set(transport.sessionId, transport);

  // Handle close
  req.on("close", () => {
    // console.log("MCP SSE connection closed", transport.sessionId);
    transportMap.delete(transport.sessionId);
  });

  // Start the transport
  await transport.start();
}
