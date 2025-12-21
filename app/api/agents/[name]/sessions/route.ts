import { NextRequest, NextResponse } from 'next/server';
import { createADKSession, listADKSessions, checkADKHealth } from '@/lib/adk';
import { auth } from '@/auth';

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
    // Check auth
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Use nickarinard@gmail.com only for builder_agent (dogfooding)
    // Other agents use the authenticated user's email
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

    // List sessions from the ADK backend
    const sessions = await listADKSessions(name, userId);

    // Fetch API Key info from Postgres for these sessions
    const { query } = await import('@/lib/db/client');
    const sessionIds = sessions.map(s => s.id);
    
    let apiKeyMap: Record<string, string> = {};
    if (sessionIds.length > 0) {
      const dbInfo = await query<{ session_id: string, key_name: string }>(
        `SELECT s.id as session_id, k.name as key_name 
         FROM agent_sessions s 
         JOIN api_keys k ON s.api_key_id = k.id 
         WHERE s.id = ANY($1)`,
        [sessionIds]
      );
      apiKeyMap = dbInfo.reduce((acc, row) => {
        acc[row.session_id] = row.key_name;
        return acc;
      }, {} as Record<string, string>);
    }

    // Convert to format expected by frontend (snake_case keys)
    const formattedSessions = sessions.map(s => ({
      session_id: s.id,
      agent_name: s.appName,
      user_id: s.userId,
      state: s.state,
      last_update_time: s.lastUpdateTime,
      api_key_name: apiKeyMap[s.id] || null,
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
    // Check auth
    const authSession = await auth();
    if (!authSession?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Use nickarinard@gmail.com only for builder_agent (dogfooding)
    // Other agents use the authenticated user's email
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

    // Create session at the ADK backend
    const session = await createADKSession(name, userId);

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
