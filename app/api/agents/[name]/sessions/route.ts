import { NextRequest, NextResponse } from 'next/server';
import { createADKSession, listADKSessions, checkADKHealth } from '@/lib/adk';

const DEFAULT_USER_ID = 'default-user';

/**
 * GET /api/agents/[name]/sessions
 *
 * List all sessions for a specific agent/project.
 * Returns an array of session objects with metadata.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  try {
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

    // List sessions from the ADK backend
    const sessions = await listADKSessions(name, DEFAULT_USER_ID);

    // Convert to format expected by frontend (snake_case keys)
    const formattedSessions = sessions.map(s => ({
      session_id: s.id,
      agent_name: s.appName,
      user_id: s.userId,
      state: s.state,
      last_update_time: s.lastUpdateTime,
      // Approximate message count from events (user messages only)
      message_count: s.events ? Math.ceil((s.events as unknown[]).length / 2) : 0,
    }));

    return NextResponse.json({ sessions: formattedSessions });
  } catch (error) {
    console.error('Error listing sessions:', error);
    return NextResponse.json(
      {
        error: 'Failed to list sessions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/[name]/sessions
 *
 * Create a new session for the specified agent/project.
 * Returns the newly created session object with a unique session ID.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  try {
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

    // Create session at the ADK backend
    const session = await createADKSession(name, DEFAULT_USER_ID);

    // Return in format expected by frontend (session_id in snake_case)
    return NextResponse.json({
      session_id: session.id,
      agent_name: session.appName,
      user_id: session.userId,
      state: session.state,
    });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      {
        error: 'Failed to create session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
