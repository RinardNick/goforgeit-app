import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export const runtime = 'nodejs';

// Timeout for MCP connection attempts (5 seconds)
const CONNECTION_TIMEOUT = 5000;

interface MCPTool {
  name: string;
  description: string;
}

interface ValidationResult {
  status: 'connected' | 'error' | 'timeout';
  tools: MCPTool[];
  errorMessage?: string;
  serverInfo?: {
    name?: string;
    version?: string;
  };
}

interface StdioConfig {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface SSEConfig {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
}

type MCPServerConfig = StdioConfig | SSEConfig;

/**
 * Validate an MCP server configuration by attempting to connect and list tools
 */
async function validateStdioServer(config: StdioConfig): Promise<ValidationResult> {
  let client: Client | null = null;
  let transport: StdioClientTransport | null = null;

  try {
    // Create transport with the stdio configuration
    transport = new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env: config.env,
    });

    // Create MCP client
    client = new Client({
      name: 'adk-visual-builder',
      version: '1.0.0',
    });

    // Wrap connection in a timeout
    const connectPromise = client.connect(transport);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT)
    );

    await Promise.race([connectPromise, timeoutPromise]);

    // Get server info if available
    const serverInfo = client.getServerVersion();

    // List available tools
    const toolsResult = await client.listTools();
    const tools: MCPTool[] = (toolsResult.tools || []).map((t) => ({
      name: t.name,
      description: t.description || '',
    }));

    return {
      status: 'connected',
      tools,
      serverInfo: serverInfo
        ? {
            name: serverInfo.name,
            version: serverInfo.version,
          }
        : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Check for specific error types
    if (message.includes('ENOENT') || message.includes('spawn')) {
      return {
        status: 'error',
        tools: [],
        errorMessage: `Command not found: ${config.command}`,
      };
    }

    if (message.includes('timeout')) {
      return {
        status: 'timeout',
        tools: [],
        errorMessage: 'Connection timed out. Server may not be responding.',
      };
    }

    return {
      status: 'error',
      tools: [],
      errorMessage: message,
    };
  } finally {
    // Clean up
    try {
      if (client) {
        await client.close();
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Validate an SSE server configuration
 */
async function validateSSEServer(config: SSEConfig): Promise<ValidationResult> {
  let client: Client | null = null;

  try {
    const url = new URL(config.url);

    // Create SSE transport
    const transport = new SSEClientTransport(url);

    // Create MCP client
    client = new Client({
      name: 'adk-visual-builder',
      version: '1.0.0',
    });

    // Wrap connection in a timeout
    const connectPromise = client.connect(transport);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT)
    );

    await Promise.race([connectPromise, timeoutPromise]);

    // Get server info if available
    const serverInfo = client.getServerVersion();

    // List available tools
    const toolsResult = await client.listTools();
    const tools: MCPTool[] = (toolsResult.tools || []).map((t) => ({
      name: t.name,
      description: t.description || '',
    }));

    return {
      status: 'connected',
      tools,
      serverInfo: serverInfo
        ? {
            name: serverInfo.name,
            version: serverInfo.version,
          }
        : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('ECONNREFUSED') || message.includes('fetch')) {
      return {
        status: 'error',
        tools: [],
        errorMessage: `Cannot connect to ${config.url}. Server may not be running.`,
      };
    }

    if (message.includes('timeout')) {
      return {
        status: 'timeout',
        tools: [],
        errorMessage: 'Connection timed out. Server may not be responding.',
      };
    }

    return {
      status: 'error',
      tools: [],
      errorMessage: message,
    };
  } finally {
    try {
      if (client) {
        await client.close();
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * POST /api/mcp/validate
 * Validate an MCP server configuration by attempting to connect and discover tools
 */
export async function POST(req: NextRequest) {
  try {
    const config = (await req.json()) as MCPServerConfig;

    // Validate request body
    if (!config.type) {
      return NextResponse.json(
        { status: 'error', tools: [], errorMessage: 'Server type is required' },
        { status: 400 }
      );
    }

    if (config.type === 'stdio') {
      if (!config.command) {
        return NextResponse.json(
          { status: 'error', tools: [], errorMessage: 'Command is required for stdio servers' },
          { status: 400 }
        );
      }
      const result = await validateStdioServer(config);
      return NextResponse.json(result);
    }

    if (config.type === 'sse') {
      if (!config.url) {
        return NextResponse.json(
          { status: 'error', tools: [], errorMessage: 'URL is required for SSE servers' },
          { status: 400 }
        );
      }
      const result = await validateSSEServer(config);
      return NextResponse.json(result);
    }

    // This should never be reached due to prior validation, but TypeScript needs the fallback
    const unknownType = (config as { type: string }).type;
    return NextResponse.json(
      { status: 'error', tools: [], errorMessage: `Unknown server type: ${unknownType}` },
      { status: 400 }
    );
  } catch (error) {
    console.error('MCP validation error:', error);
    return NextResponse.json(
      {
        status: 'error',
        tools: [],
        errorMessage: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
