import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/client';
import { auth } from '@/auth';
import { ensureUserOrg } from '@/lib/db/utils';

/**
 * GET /api/projects
 * List all projects for the authenticated user's organization
 */
export async function GET(req: NextRequest) {
  console.log('GET /api/projects hit (unwrapped)');
  
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Skipping DB calls for debugging');
    return NextResponse.json({ projects: [] });
  } catch (error) {
    console.error('Error listing projects:', error);
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 });
  }
}

/**
 * POST /api/projects
 * Create a new project in the authenticated user's organization
 *
 * Using auth() wrapper pattern for NextAuth v5 compatibility
 */
export const POST = auth(async (req) => {
  try {
    // req.auth contains the session when using auth() wrapper
    if (!req.auth?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await ensureUserOrg(req.auth.user.email);
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
});
