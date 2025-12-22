import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/client';
import { auth } from '@/auth';
import { ensureUserOrg } from '@/lib/db/utils';

export const runtime = 'nodejs';

/**
 * GET /api/projects
 * List all projects for the authenticated user's organization
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure user has an organization
    const org = await ensureUserOrg(session.user.email);

    const projects = await query(
      'SELECT * FROM projects WHERE org_id = $1 ORDER BY created_at DESC',
      [org.id]
    );

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error listing projects:', error);
    return NextResponse.json({ 
      error: 'Failed to list projects',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * POST /api/projects
 * Create a new project in the authenticated user's organization
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await ensureUserOrg(session.user.email);
    const body = await req.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const project = await query(
      'INSERT INTO projects (org_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [org.id, name, description]
    );

    return NextResponse.json({ project: project[0] });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}