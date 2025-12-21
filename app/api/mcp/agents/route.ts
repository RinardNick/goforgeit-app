import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/auth/api-keys';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { listADKAgents, executeADKAgent, getADKAgentYAML } from '@/lib/adk/client';
import yaml from 'js-yaml';

// Map session IDs to transports
const transports = new Map<string, NextSseTransport>();

class NextSseTransport implements Transport {
  private controller: ReadableStreamDefaultController | null = null;
  public onmessage?: (message: JSONRPCMessage) => void;
  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  init(controller: ReadableStreamDefaultController) {
    this.controller = controller;
    // Send endpoint event required by MCP SSE spec
    this.sendSseEvent('endpoint', `/api/mcp/agents?sessionId=${this.sessionId}`);
  }

  async start() {
    // Ready
  }

  async close() {
    try {
      this.controller?.close();
    } catch (e) {
      // Ignore if already closed
    }
    this.onclose?.();
    transports.delete(this.sessionId);
  }

  async send(message: JSONRPCMessage) {
    this.sendSseEvent('message', JSON.stringify(message));
  }

  private sendSseEvent(type: string, data: string) {
    if (!this.controller) return;
    const encoder = new TextEncoder();
    this.controller.enqueue(encoder.encode(`event: ${type}\ndata: ${data}\n\n`));
  }

  async handlePostMessage(message: JSONRPCMessage) {
    this.onmessage?.(message);
  }
}

// Initialize MCP Server
const server = new McpServer({
  name: 'ADK Meta-MCP',
  version: '1.0.0',
});

// Helper to register tools dynamically
async function registerAgentTools() {
  try {
    const agents = await listADKAgents();
    
    // Note: server.tool() registers tools. We cannot easily unregister/update in current SDK version
    // without accessing private properties. For now, we assume this process is short-lived 
    // or we just append (SDK throws on duplicate).
    
    // Check if we can access tools map? No.
    // We'll wrap in try-catch to ignore duplicate registration errors.

    for (const agentName of agents) {
      let description = `Execute the ${agentName} agent.`;
      try {
        const agentYaml = await getADKAgentYAML(agentName);
        const config = yaml.load(agentYaml) as { description?: string, instruction?: string };
        if (config.description) description = config.description;
      } catch (e) {
        // Ignore YAML fetch errors
      }

      const toolName = `agent_${agentName}`;
      
      try {
          server.tool(
            toolName,
            description,
            { prompt: z.string().describe('The input prompt for the agent') },
            async ({ prompt }) => {
              const result = await executeADKAgent(agentName, prompt);
              return {
                content: [{ type: 'text', text: result.response }],
              };
            }
          );
      } catch (e) {
          // Tool likely already registered, ignore
      }
    }
  } catch (e) {
    console.error('Failed to register ADK tools:', e);
  }
}

// ... existing imports

// ... existing helper classes/functions

// GET: Establish SSE connection
export async function GET(req: NextRequest) {
  // Check API Key
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  const orgId = await validateApiKey(apiKey || '');
  
  if (!orgId) {
    return new Response('Unauthorized: Invalid API Key', { status: 401 });
  }

  // Refresh tools
  await registerAgentTools();

  const sessionId = crypto.randomUUID();
  const transport = new NextSseTransport(sessionId);
  transports.set(sessionId, transport);

  // ... rest of implementation
}

// POST: Handle client messages
export async function POST(req: NextRequest) {
  // Check API Key
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  const orgId = await validateApiKey(apiKey || '');
  
  if (!orgId) {
    return new Response('Unauthorized: Invalid API Key', { status: 401 });
  }

  const reqUrl = new URL(req.url);
  const sessionId = reqUrl.searchParams.get('sessionId');
  // ... rest of implementation
}