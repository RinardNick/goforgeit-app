import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');
const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'goforgeit-adk-agents';
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
 * DELETE /api/agents/[name]
 * Delete an ADK agent project and all its files
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    if (!name) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    if (USE_GCS) {
      // Production: Delete from GCS
      const bucket = getStorage().bucket(GCS_BUCKET);
      const [files] = await bucket.getFiles({ prefix: `${name}/` });

      if (files.length === 0) {
        return NextResponse.json(
          { error: `Project not found: ${name}` },
          { status: 404 }
        );
      }

      // Delete all files in the agent directory
      await Promise.all(files.map(file => file.delete()));

      return NextResponse.json({
        success: true,
        message: `Project ${name} deleted successfully`,
      });
    } else {
      // Local: Delete from filesystem
      const projectDir = path.join(ADK_AGENTS_DIR, name);

      // Check if project exists
      try {
        await fs.access(projectDir);
      } catch {
        return NextResponse.json(
          { error: `Project not found: ${name}` },
          { status: 404 }
        );
      }

      // Remove the project directory and all contents recursively
      await fs.rm(projectDir, { recursive: true, force: true });

      return NextResponse.json({
        success: true,
        message: `Project ${name} deleted successfully`,
      });
    }
  } catch (error) {
    console.error('Error deleting ADK agent project:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete ADK agent project',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
