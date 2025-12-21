import { NextRequest, NextResponse } from 'next/server';
import { getADKSession, deleteADKSession, updateADKSession, checkADKHealth } from '@/lib/adk';
import { auth } from '@/auth';
import { z } from 'zod';

// Schema for PATCH request validation
const UpdateSessionSchema = z.object({
  stateDelta: z.record(z.unknown()),
});

/**
 * DELETE /api/agents/[name]/sessions/[sessionId]
 *
 * Delete a specific session by ID.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ name: string; sessionId: string }> }
) {
  const { name, sessionId } = await params;

  try {
    // Check auth
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Use nickarinard@gmail.com only for builder_agent (dogfooding)
    const userId = name === 'builder_agent'
      ? 'nickarinard@gmail.com'
      : session.user.email;

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

    // Delete session at the ADK backend
    await deleteADKSession(name, userId, sessionId);

    return NextResponse.json({ success: true, sessionId });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/[name]/sessions/[sessionId]
 *
 * Get details of a specific session including its state and messages.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string; sessionId: string }> }
) {
  const { name, sessionId } = await params;

  try {
    // Check auth
    const authSession = await auth();
    if (!authSession?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Use nickarinard@gmail.com only for builder_agent (dogfooding)
    const userId = name === 'builder_agent'
      ? 'nickarinard@gmail.com'
      : authSession.user.email;

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

    // Get session from the ADK backend
    const session = await getADKSession(name, userId, sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Return in format expected by frontend, including events for message history
    return NextResponse.json({
      session_id: session.id,
      agent_name: session.appName,
      user_id: session.userId,
      state: session.state,
      events: session.events || [],
      lastUpdateTime: session.lastUpdateTime,
    });
  } catch (error) {
    console.error('Error getting session:', error);
    return NextResponse.json(
      {
        error: 'Failed to get session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agents/[name]/sessions/[sessionId]
 *
 * Update session state without executing the agent.
 * Uses the ADK PATCH endpoint: /apps/{app}/users/{user}/sessions/{session_id}
 *
 * Request body: { stateDelta: { key: value, ... } }
 * Response: Updated session with merged state
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ name: string; sessionId: string }> }
) {
  const { name, sessionId } = await params;

  try {
    // Check auth
    const authSession = await auth();
    if (!authSession?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Use nickarinard@gmail.com only for builder_agent (dogfooding)
    const userId = name === 'builder_agent'
      ? 'nickarinard@gmail.com'
      : authSession.user.email;

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

    const validation = UpdateSessionSchema.safeParse(body);
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

    const { stateDelta } = validation.data;

    // Update session state at the ADK backend
    const updatedSession = await updateADKSession(name, userId, sessionId, stateDelta);

    // Return updated session in format expected by frontend
    return NextResponse.json({
      session_id: updatedSession.id,
      agent_name: updatedSession.appName,
      user_id: updatedSession.userId,
      state: updatedSession.state,
      events: updatedSession.events || [],
      lastUpdateTime: updatedSession.lastUpdateTime,
    });
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json(
      {
        error: 'Failed to update session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
