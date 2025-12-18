import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import fs from 'fs/promises';
import path from 'path';
import { auth } from '@/auth';
import { ensureUserOrg } from '@/lib/db/utils';
import { query } from '@/lib/db/client';

export const runtime = 'nodejs';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');
const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'nicholasrinard-adk-agents';
const USE_GCS = process.env.NODE_ENV === 'production';

// Initialize GCS client (lazy)
let storage: Storage | null = null;
function getStorage(): Storage {
  if (!storage) {
    storage = new Storage();
  }
  return storage;
}

/**
 * PATCH /api/agents/[name]
 * Update an agent (e.g. move to a different project)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await ensureUserOrg(session.user.email);
    const { name } = await params;
    const body = await req.json();
    const { projectId } = body;

    // Move to project (or root if null)
    if (projectId !== undefined) {
      if (projectId) {
        // Verify project belongs to org
        const project = await query(
          'SELECT id FROM projects WHERE id = $1 AND org_id = $2',
          [projectId, org.id]
        );
        if (project.length === 0) {
          return NextResponse.json({ error: 'Project not found' }, { status: 403 });
        }
      }

      await query(
        'UPDATE agents SET project_id = $1 WHERE name = $2 AND org_id = $3',
        [projectId || null, name, org.id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }
}

/**
 * DELETE /api/agents/[name]
 * Delete an ADK agent project and all its files
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await ensureUserOrg(session.user.email);
    const { name } = await params;

    if (!name) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      );
    }

    // Delete from DB first
    await query(
      'DELETE FROM agents WHERE name = $1 AND org_id = $2',
      [name, org.id]
    );

    if (USE_GCS) {
      // Production: Delete from GCS
      const bucket = getStorage().bucket(GCS_BUCKET);
      const [files] = await bucket.getFiles({ prefix: `${name}/` });

      if (files.length === 0) {
        // Even if not found in GCS, we deleted from DB, so success?
        // Let's warn but return success to keep state clean.
        console.warn(`Agent files not found in GCS: ${name}`);
      } else {
        // Delete all files in the agent directory
        await Promise.all(files.map(file => file.delete()));
      }
    } else {
      // Local: Delete from filesystem
      const projectDir = path.join(ADK_AGENTS_DIR, name);

      // Check if project exists
      try {
        await fs.access(projectDir);
        // Remove the project directory and all contents recursively
        await fs.rm(projectDir, { recursive: true, force: true });
      } catch {
        // Directory doesn't exist
      }
    }

    return NextResponse.json({
      success: true,
      message: `Agent ${name} deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting ADK agent:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete ADK agent',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}