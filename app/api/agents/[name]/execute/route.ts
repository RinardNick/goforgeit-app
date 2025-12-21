import { NextRequest, NextResponse } from 'next/server';
import { executeADKAgent, executeADKAgentStream, checkADKHealth, createADKSession } from '@/lib/adk';
import { z } from 'zod';
import { auth } from '@/auth';
import { ensureUserOrg } from '@/lib/db/utils';
import { validateApiKey } from '@/lib/db/api-keys';
import { queryOne, query } from '@/lib/db/client';

export const runtime = 'nodejs';

// Request validation schema
const ExecuteADKAgentSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  sessionId: z.string().optional(),
  streaming: z.boolean().optional().default(false),
});

/**
 * POST /api/agents/[name]/execute
 * Execute an ADK agent with the given message
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: agentName } = await params;

    let orgId: string;
    let userId: string;
    let apiKeyUsed: any = null;

    const apiKeyHeader = req.headers.get('X-Forge-Api-Key');

    if (apiKeyHeader) {
      // 1. API Key Auth
      const key = await validateApiKey(apiKeyHeader);
      if (!key) {
        return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 });
      }

      // Check scoping
      // If scoped_agents is not null, the agentName must be one of the allowed agents.
      // But agentName here is the ADK folder name/slug. 
      // scoped_agents contains UUIDs.
      // We need to resolve agentName to UUID to check.
      const agent = await queryOne<{ id: string }>(
        'SELECT id FROM agents WHERE name = $1 AND org_id = $2',
        [agentName, key.org_id]
      );

      if (!agent) {
         // Agent not found in this org
         return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      }

      if (key.scoped_agents && key.scoped_agents.length > 0) {
        if (!key.scoped_agents.includes(agent.id)) {
           return NextResponse.json({ error: 'API Key not authorized for this agent' }, { status: 403 });
        }
      }

      orgId = key.org_id;
      
      // For API key usage, we use the key creator as the user context
      userId = key.created_by;
      apiKeyUsed = key;

    } else {
      // 2. Session Auth
      const session = await auth();
      if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const org = await ensureUserOrg(session.user.email);
      orgId = org.id;
      userId = session.user.email;
    }

    // Check if ADK backend is available
    const isHealthy = await checkADKHealth();
    if (!isHealthy) {
      return NextResponse.json(
        {
          error: 'ADK backend unavailable',
          hint: 'Make sure the ADK server is running: make dev-adk',
        },
        { status: 503 }
      );
    }

    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const validation = ExecuteADKAgentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    let { message, sessionId, streaming } = validation.data;

    // Handle session ID logic for API Keys
    if (apiKeyUsed && !sessionId) {
      // Explicitly create session to ensure it exists and we can link it
      try {
        const session = await createADKSession(agentName, userId);
        sessionId = session.id;
        
        // Link API Key to Session in DB
        await query(
          'UPDATE agent_sessions SET api_key_id = $1 WHERE id = $2',
          [apiKeyUsed.id, sessionId]
        );
      } catch (err) {
        console.error('Failed to create/link session:', err);
        // Fallback: let executeADKAgent create it, but we might miss the link if ADK ignores headers
      }
    }

    // Headers for billing/tracking/context
    const headers: Record<string, string> = {
      'x-org-id': orgId,
      'x-user-id': userId,
    };
    
    if (apiKeyUsed) {
      headers['x-api-key-id'] = apiKeyUsed.id;
      headers['x-api-key-name'] = apiKeyUsed.name;
    }

    // Handle streaming mode
    if (streaming) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const generator = executeADKAgentStream(agentName, message, {
              sessionId,
              userId,
              headers,
            });

            let result;
            for await (const chunk of generator) {
              // Send text chunks as they arrive
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`));
            }

            // Get final result
            result = await generator.next();
            if (result.value && typeof result.value !== 'string') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'done',
                sessionId: result.value.sessionId,
                events: result.value.events,
                toolCalls: result.value.toolCalls
              })}

`));
            }
          } catch (error) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : 'Unknown error'
            })}

`));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Execute the ADK agent (non-streaming)
    const result = await executeADKAgent(agentName, message, {
      sessionId,
      userId,
      headers,
    });

    return NextResponse.json({
      response: result.response,
      sessionId: result.sessionId,
      toolCalls: result.toolCalls,
      events: result.events, // Full ADK events for debugging/tracing
      source: 'adk',
    });
  } catch (error) {
    console.error('Error executing ADK agent:', error);

    return NextResponse.json(
      {
        error: 'Failed to execute ADK agent',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}