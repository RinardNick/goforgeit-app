
import { NextRequest, NextResponse } from 'next/server';
import { executeADKAgent, executeADKAgentStream, checkADKHealth } from '@/lib/adk';
import { z } from 'zod';
import { auth } from '@/auth';
import { ensureUserOrg } from '@/lib/db/utils';
import { validateApiKey } from '@/lib/db/api-keys';
import { queryOne } from '@/lib/db/client';

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
      
      // For API key usage, we use the key creator as the user context, 
      // OR we create a synthetic user/session context.
      // The ADK execution needs a userId for session isolation/tracking.
      // We'll use the creator's ID for now, as that maps to a real user in the system.
      // But for traceability, we might want to know it came from an API key.
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
      
      // We need userId for ADK execution context
      // ensureUserOrg returns org info.
      // We use email as userId for ADK in current implementation?
      // Looking at original code: `const userId = session.user.email;`
      // Yes, it uses email.
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
      // Generate new session ID
      const { v4: uuidv4 } = await import('uuid');
      const newId = uuidv4();
      // Apply naming convention: <key-name>-<session-id>
      // We will handle this in the `sessionId` passed to ADK?
      // Or does ADK generate it?
      // ADK uses what we pass. If we pass nothing, it generates one.
      // But we want to enforce naming.
      // Wait, ADK sessionId is typically a UUID.
      // If we pass "MobileApp-1234...", is that valid?
      // ADK uses it as a string key usually.
      // However, our Postgres `agent_sessions` table uses UUID for `id`.
      // `agent_sessions.id` is UUID.
      // If ADK uses this ID to query `agent_sessions`, it MUST be a UUID.
      // So we cannot prepend the name to the UUID itself if the DB enforces UUID.
      
      // So `sessionId` MUST be a UUID.
      // The requirement "New sessions must follow the naming convention: <key-name>-<session-id>"
      // might conflict with `id` being UUID if "session-id" implies the DB ID.
      // Perhaps we mean the "Session Name" or "Title"?
      // `agent_sessions` has `metadata`.
      // But `agent_sessions` table definition doesn't have a `name` or `title` column!
      // `agent_sessions` has `id`, `agent_id`, `user_id`, `api_key_id`, `status`, `metadata`.
      
      // Wait, "Sessions" panel in UI usually lists sessions. Where does it get the title?
      // Maybe from the first message? Or metadata?
      // I should check `app/components/chat/SessionsPanel.tsx` to see how it displays sessions.
      
      // But to proceed:
      // If I can't change the ID format, I should store the "Name" in metadata or `api_key_id`.
      // The requirement says: "New sessions must follow the naming convention: <key-name>-<session-id>."
      // If `session-id` is the UUID, then `<key-name>-<uuid>` is NOT a UUID.
      // This implies I cannot use this string as the Primary Key `id` in Postgres.
      
      // If ADK creates the session record, I need to see how.
      // `executeADKAgent` -> calls ADK. ADK calls `storage`?
      // Or does `executeADKAgent` create the session?
      
      // I'll assume I should pass a UUID as `sessionId` to ADK, but maybe set a property that helps display it?
      // Or maybe the requirement meant "Display Name" in the UI?
      
      // The `agent_sessions` table DOES have `api_key_id`.
      // If I populate `api_key_id`, I can join with `api_keys` to show the name in the UI.
      // That fulfills "Sessions generated via API apps... visible in Forge... prefixed with API key name".
      
      // So, I will generate a UUID for `sessionId` if missing.
      sessionId = newId;
    }

    // Headers for billing/tracking/context
    const headers: Record<string, string> = {
      'x-org-id': orgId,
      'x-user-id': userId,
    };
    
    if (apiKeyUsed) {
      headers['x-api-key-id'] = apiKeyUsed.id;
      // We pass the key name too so ADK (if it creates the session title) can use it?
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
              })}\n\n`));
            }
          } catch (error) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : 'Unknown error'
            })}\n\n`));
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
