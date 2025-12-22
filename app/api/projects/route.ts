import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/client';
import { auth } from '@/auth';
import { ensureUserOrg } from '@/lib/db/utils';
import { headers, cookies } from 'next/headers';

export const runtime = 'nodejs';

/**
 * GET /api/projects
 * List all projects for the authenticated user's organization
 */
export async function GET(req: NextRequest) {
  console.log('GET /api/projects hit (unwrapped)');
  
  try {
    const headerList = await headers();
    const cookieStore = await cookies();
    
    console.log('Headers count:', [...headerList.keys()].length);
    console.log('Cookies count:', [...cookieStore.getAll()].length);
    
    console.log('Calling auth()...');
    const session = await auth();
    console.log('auth() success, session exists:', !!session);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Skipping DB calls for debugging');
    return NextResponse.json({ projects: [] });
  } catch (error) {
    console.error('Error listing projects:', error);
    return NextResponse.json({ 
      error: 'Failed to list projects',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

/**
 * POST /api/projects
 * Create a new project in the authenticated user's organization
 */
export async function POST(req: NextRequest) {
  console.log('POST /api/projects hit (unwrapped)');
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
