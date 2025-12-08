import { NextRequest, NextResponse } from 'next/server';
import { listADKSessions, deleteADKSession, checkADKHealth } from '@/lib/adk';

const DEFAULT_USER_ID = 'default-user';

/**
 * DELETE /api/agents/[name]/sessions/cleanup
 *
 * Clear all sessions for a specific agent (TEST PROJECTS ONLY)
 * This is used for test cleanup to ensure isolation between test runs
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // SAFETY: Only allow cleanup for test projects
  const TEST_PROJECT_PREFIXES = ['test-', 'marketing-team', 'my-agent'];
  const isTestProject = TEST_PROJECT_PREFIXES.some(prefix => name.startsWith(prefix));

  if (!isTestProject) {
    return NextResponse.json(
      { error: 'Cleanup only allowed for test projects' },
      { status: 403 }
    );
  }

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

    // List all sessions for this agent and delete them
    const sessions = await listADKSessions(name, DEFAULT_USER_ID);
    let deletedCount = 0;

    for (const session of sessions) {
      await deleteADKSession(name, DEFAULT_USER_ID, session.id);
      deletedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Cleared ${deletedCount} sessions for ${name}`,
      deletedCount,
    });
  } catch (error) {
    console.error('Error clearing sessions:', error);
    return NextResponse.json(
      {
        error: 'Failed to clear sessions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
