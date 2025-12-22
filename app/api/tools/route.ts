import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { registerTool, listTools } from '@/lib/db/tool-registry';
import { getUserOrg } from '@/lib/db/utils';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await getUserOrg(session.user.email);

    if (!org) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    try {
      const tools = await listTools(org.id);
      return NextResponse.json(tools);
    } catch (error) {
      console.error('Failed to list tools:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  } catch (err) {
    console.error('[API/Tools] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await getUserOrg(session.user.email);

    if (!org) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    try {
      const body = await req.json();
      const tool = await registerTool({
        ...body,
        orgId: org.id,
      });
      return NextResponse.json(tool);
    } catch (error) {
      console.error('Failed to register tool:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  } catch (err) {
    console.error('[API/Tools] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
