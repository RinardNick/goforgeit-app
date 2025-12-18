import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ensureUserOrg } from '@/lib/db/utils';
import {
  listProviderKeys,
  upsertProviderKey,
  deleteProviderKey,
  Provider,
} from '@/lib/db/provider-keys';
import { validateKeyFormat } from '@/lib/crypto/provider-keys';
import { z } from 'zod';

const VALID_PROVIDERS: Provider[] = ['google', 'openai', 'anthropic'];

const UpsertKeySchema = z.object({
  provider: z.enum(['google', 'openai', 'anthropic']),
  apiKey: z.string().min(1, 'API key is required'),
  label: z.string().optional(),
  validate: z.boolean().optional().default(true),
});

const DeleteKeySchema = z.object({
  provider: z.enum(['google', 'openai', 'anthropic']),
});

/**
 * GET /api/settings/provider-keys
 * List all configured provider keys (masked) for the current org
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await ensureUserOrg(session.user.email);
    const keys = await listProviderKeys(org.id);

    return NextResponse.json({ keys });
  } catch (error) {
    console.error('[ProviderKeys API] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch provider keys' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/provider-keys
 * Create or update a provider key
 */
export async function PUT(req: NextRequest) {
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

    const validation = UpsertKeySchema.safeParse(body);
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

    const { provider, apiKey, label, validate } = validation.data;

    // Validate key format
    const formatValidation = validateKeyFormat(provider, apiKey);
    if (!formatValidation.valid) {
      return NextResponse.json(
        { error: formatValidation.error, code: 'INVALID_KEY_FORMAT' },
        { status: 400 }
      );
    }

    // Optional: Validate key works with provider
    let validated = false;
    if (validate) {
      const validationResult = await validateKeyWithProvider(provider, apiKey);
      if (!validationResult.valid) {
        return NextResponse.json(
          { error: validationResult.error, code: 'KEY_VALIDATION_FAILED' },
          { status: 400 }
        );
      }
      validated = true;
    }

    // Get user ID for audit
    const userId = session.user.id || session.user.email;

    // Upsert the key
    const result = await upsertProviderKey(org.id, provider, apiKey, userId, label);

    return NextResponse.json({
      success: true,
      key: result,
      validated,
    });
  } catch (error) {
    console.error('[ProviderKeys API] PUT Error:', error);
    return NextResponse.json(
      { error: 'Failed to save provider key' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/provider-keys
 * Delete a provider key
 */
export async function DELETE(req: NextRequest) {
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

    const validation = DeleteKeySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    const { provider } = validation.data;

    await deleteProviderKey(org.id, provider);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ProviderKeys API] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete provider key' },
      { status: 500 }
    );
  }
}

/**
 * Validate an API key by making a test request to the provider
 */
async function validateKeyWithProvider(
  provider: Provider,
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    switch (provider) {
      case 'google': {
        // Test Gemini API key by listing models
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
          { method: 'GET' }
        );
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          return {
            valid: false,
            error: data.error?.message || 'Invalid Google API key',
          };
        }
        return { valid: true };
      }

      case 'openai': {
        // Test OpenAI API key by listing models
        const response = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          return {
            valid: false,
            error: data.error?.message || 'Invalid OpenAI API key',
          };
        }
        return { valid: true };
      }

      case 'anthropic': {
        // Anthropic doesn't have a simple list endpoint, so we'll just validate format
        // A proper validation would require a minimal API call
        // For now, we trust the format validation
        return { valid: true };
      }

      default:
        return { valid: false, error: 'Unknown provider' };
    }
  } catch (error) {
    console.error(`[ProviderKeys] Validation error for ${provider}:`, error);
    return {
      valid: false,
      error: 'Failed to validate key. Please check your network connection.',
    };
  }
}
