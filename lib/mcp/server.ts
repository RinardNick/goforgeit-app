import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { 
  createAgentTool, 
  listAgentsTool, 
  readAgentTool, 
  modifyAgentTool, 
  addSubAgentTool, 
  addToolTool, 
  removeToolTool, 
  deleteAgentTool,
  taskCompleteTool
} from "../genkit/tools/builder-tools";

// Initialize server
export const mcpServer = new McpServer({
  name: "Forge System Tools",
  version: "1.0.0",
});

// Register tools
const tools = [
  createAgentTool(),
  listAgentsTool(),
  readAgentTool(),
  modifyAgentTool(),
  addSubAgentTool(),
  addToolTool(),
  removeToolTool(),
  deleteAgentTool(),
  taskCompleteTool(),
];

for (const tool of tools) {
  // @ts-ignore
  const action = tool.__action;
  
  if (!action) continue;

  mcpServer.tool(
    action.name,
    action.description || "",
    // @ts-ignore
    action.inputSchema ? zodToJsonSchema(action.inputSchema) : {}, 
    async (args) => {
      // Execute the tool
      const result = await tool(args);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    }
  );
}

// Transport Management (Simple in-memory for serverless/stateless Next.js?)
// MCP over SSE requires stateful connection management usually.
// Next.js Route Handlers are stateless.
// We need to store the transport/connection info or keep the stream open.

// For GET /sse, we return a Response with stream.
// For POST /messages, we need to find the transport associated with sessionId? 
// The SDK's SSEServerTransport handles this by generating a sessionId and expecting it in the URL of the POST.

// Implementation pattern for Next.js Route Handlers:
// We can't easily share state between the GET request (SSE) and the POST request (Messages) in serverless.
// But we can use global variables if we assume single instance (dev) or external store (prod).
// Since we are running in "App Platform" mode (stateful container?) or Vercel (serverless)?
// `adk-service` calls this.

// If we are serverless, MCP SSE is hard.
// However, the `builder_agent` runs in `adk-service`. It connects to this MCP server.
// If we use standard HTTP (stateless) for tools?
// MCP protocol is stateful.

// Workaround: Use a simple global map for transports. This works in `next dev` and Cloud Run (single instance with session affinity or just luck).
// For robust prod, we'd need a shared store (Redis).
// Given "Phase 3: Dynamic Tool Factory", let's assume we can run a persistent process or use a simplified transport.

export const transportMap = new Map<string, SSEServerTransport>();
