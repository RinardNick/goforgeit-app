import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
  taskCompleteTool,
  createPythonToolTool
} from "../genkit/tools/builder-tools";
import { WebSSETransport } from "./transport";

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
  createPythonToolTool(),
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
      const result = await tool(args);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    }
  );
}

// Global transport map for WebSSETransport
export const transportMap = new Map<string, WebSSETransport>();