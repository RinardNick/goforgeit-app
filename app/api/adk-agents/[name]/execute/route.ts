import { NextRequest, NextResponse } from 'next/server';
import { executeADKAgent, executeADKAgentStream, checkADKHealth } from '@/lib/adk';
import { auth } from '@/auth';
import { z } from 'zod';

export const runtime = 'nodejs';

// Request validation schema
const ExecuteADKAgentSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  sessionId: z.string().optional(),
  streaming: z.boolean().optional().default(false),
});

/**
 * POST /api/adk-agents/[name]/execute
 * Execute an ADK agent with the given message
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: agentName } = await params;

    // Check auth - use email as userId for session isolation
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.email;

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

    const { message, sessionId, streaming } = validation.data;

    // Handle streaming mode
    if (streaming) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const generator = executeADKAgentStream(agentName, message, {
              sessionId,
              userId,
            });

            let result;
            for await (const chunk of generator) {
              // Send text chunks as they arrive
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`));
            }

            // Get final result
            result = await generator.next();
            if (result.value && typeof result.value === 'object' && 'sessionId' in result.value) {
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
