import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTool, updateTool, deleteTool } from '@/lib/db/tool-registry';
import { queryOne } from '@/lib/db/client';

async function checkOwnership(email: string, toolId: string) {
  const tool = await getTool(toolId);
  if (!tool) return { error: 'Not Found', status: 404 };

  // Resolve user ID from email
  const user = await queryOne('SELECT id FROM "User" WHERE email = $1', [email]);
  if (!user) return { error: 'Forbidden', status: 403 };

  const member = await queryOne(
    'SELECT 1 FROM organization_members WHERE user_id = $1 AND org_id = $2',
    [user.id, tool.org_id]
  );

  if (!member) return { error: 'Forbidden', status: 403 };
  return { tool };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { tool, error, status } = await checkOwnership(session.user.email, id);
  if (error) return NextResponse.json({ error }, { status });

  return NextResponse.json(tool);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { error, status } = await checkOwnership(session.user.email, id);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const body = await req.json();
    const updated = await updateTool(id, body);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Failed to update tool:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { error, status } = await checkOwnership(session.user.email, id);
  if (error) return NextResponse.json({ error }, { status });

  try {
    await deleteTool(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to delete tool:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
