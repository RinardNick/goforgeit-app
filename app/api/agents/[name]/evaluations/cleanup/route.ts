import { NextRequest, NextResponse } from 'next/server';
import { Storage as GCSStorage } from '@google-cloud/storage';
import { promises as fs } from 'fs';
import path from 'path';
import { USE_GCS } from '@/lib/storage';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');
const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'goforgeit-adk-agents';

// Lazy-initialized GCS client
let gcsClient: GCSStorage | null = null;
function getGCS(): GCSStorage {
  if (!gcsClient) {
    gcsClient = new GCSStorage();
  }
  return gcsClient;
}

// DELETE /api/agents/[name]/evaluations/cleanup - Delete all evalsets (for testing)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: agentName } = await params;

    if (USE_GCS) {
      // Production: Delete all evaluation JSON files from GCS
      const bucket = getGCS().bucket(GCS_BUCKET);
      const [files] = await bucket.getFiles({ prefix: `${agentName}/evaluations/` });

      // Delete all JSON files
      const jsonFiles = files.filter(f => f.name.endsWith('.json'));
      await Promise.all(jsonFiles.map(file => file.delete()));

      return NextResponse.json({
        message: 'Cleanup complete',
        deletedCount: jsonFiles.length,
      });
    } else {
      // Local: Delete from filesystem
      const evalsDir = path.join(ADK_AGENTS_DIR, agentName, 'evaluations');

      try {
        await fs.access(evalsDir);
        const files = await fs.readdir(evalsDir);

        // Delete all JSON files
        let deletedCount = 0;
        for (const file of files) {
          if (file.endsWith('.json')) {
            await fs.unlink(path.join(evalsDir, file));
            deletedCount++;
          }
        }

        return NextResponse.json({
          message: 'Cleanup complete',
          deletedCount,
        });
      } catch {
        // Directory doesn't exist, nothing to clean up
        return NextResponse.json({
          message: 'Cleanup complete',
          deletedCount: 0,
        });
      }
    }
  } catch (error) {
    console.error('Error cleaning up evalsets:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup evaluations' },
      { status: 500 }
    );
  }
}
