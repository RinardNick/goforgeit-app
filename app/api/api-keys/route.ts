
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ensureUserOrg } from '@/lib/db/utils';
import { createApiKey, listApiKeys, revokeApiKey } from '@/lib/db/api-keys';
import { z } from 'zod';

const CreateKeySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  scopedAgents: z.array(z.string().uuid()).optional(),
});

const RevokeKeySchema = z.object({
  keyId: z.string().uuid(),
});

/**
 * GET /api/api-keys
 * List all API keys for the current org
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await ensureUserOrg(session.user.email);
    const keys = await listApiKeys(org.id);

    return NextResponse.json({ keys });
  } catch (error) {
    console.error('[ApiKeys API] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/api-keys
 * Create a new API key
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await ensureUserOrg(session.user.email);

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = CreateKeySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { name, description, scopedAgents } = validation.data;
    
    // Get user ID (ensureUserOrg returns user_id too if we update it, but let's just query it or use session)
    // ensureUserOrg returns { id, name, slug } of the org.
    // We need the user ID for 'created_by'. 
    // We can query it or extend ensureUserOrg.
    // Let's import queryOne and get it.
    const { queryOne } = await import('@/lib/db/client');
    const user = await queryOne<{ id: string }>(
      'SELECT id FROM "User" WHERE email = $1',
      [session.user.email]
    );
    
    if (!user) {
       return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const result = await createApiKey({
      name,
      description,
      userId: user.id,
      orgId: org.id,
      scopedAgents
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ApiKeys API] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/api-keys
 * Revoke an API key
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = RevokeKeySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error },
        { status: 400 }
      );
    }

    const { keyId } = validation.data;
    
    // Get user ID
    const { queryOne } = await import('@/lib/db/client');
    const user = await queryOne<{ id: string }>(
      'SELECT id FROM "User" WHERE email = $1',
      [session.user.email]
    );

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await revokeApiKey(keyId, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ApiKeys API] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}
