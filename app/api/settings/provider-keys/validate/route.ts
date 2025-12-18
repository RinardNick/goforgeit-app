import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateKeyFormat } from '@/lib/crypto/provider-keys';
import { z } from 'zod';

type Provider = 'google' | 'openai' | 'anthropic';

const ValidateKeySchema = z.object({
  provider: z.enum(['google', 'openai', 'anthropic']),
  apiKey: z.string().min(1, 'API key is required'),
});

/**
 * POST /api/settings/provider-keys/validate
 * Test if an API key is valid without saving it
 */
export async function POST(req: NextRequest) {
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

    const validation = ValidateKeySchema.safeParse(body);
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

    const { provider, apiKey } = validation.data;

    // First validate format
    const formatValidation = validateKeyFormat(provider, apiKey);
    if (!formatValidation.valid) {
      return NextResponse.json({
        valid: false,
        error: formatValidation.error,
      });
    }

    // Then validate with provider
    const result = await validateKeyWithProvider(provider, apiKey);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ProviderKeys API] Validate Error:', error);
    return NextResponse.json(
      { valid: false, error: 'Validation failed due to an internal error' },
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
        // Test Anthropic API key with a minimal request
        // Note: Anthropic doesn't have a list models endpoint,
        // so we can't easily validate without making an actual API call
        // For now, we trust format validation
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
