import { NextRequest, NextResponse } from 'next/server';
import { 
  validateStdioServer, 
  validateSSEServer, 
  MCPServerConfig 
} from '@/lib/mcp/client';

export const runtime = 'nodejs';

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
