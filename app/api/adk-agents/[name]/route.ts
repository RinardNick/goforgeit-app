import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');

/**
 * DELETE /api/adk-agents/[name]
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
