import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');

// DELETE /api/adk-agents/[name]/evaluations/cleanup - Delete all evalsets (for testing)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: agentName } = await params;
    const evalsDir = path.join(ADK_AGENTS_DIR, agentName, 'evaluations');

    try {
      await fs.access(evalsDir);
      const files = await fs.readdir(evalsDir);

      // Delete all JSON files
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(evalsDir, file));
        }
      }
    } catch {
      // Directory doesn't exist, nothing to clean up
    }

    return NextResponse.json({ message: 'Cleanup complete' });
  } catch (error) {
    console.error('Error cleaning up evalsets:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup evaluations' },
      { status: 500 }
    );
  }
}
