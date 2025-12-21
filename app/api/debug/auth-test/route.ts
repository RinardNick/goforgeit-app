import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export const runtime = 'nodejs';

/**
 * Diagnostic endpoint to debug auth issues in Cloud Run
 * This endpoint logs request state and auth behavior
 */
export async function GET(req: NextRequest) {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      AUTH_URL: process.env.AUTH_URL ? 'SET' : 'NOT_SET',
      AUTH_SECRET: process.env.AUTH_SECRET ? 'SET' : 'NOT_SET',
    },
    request: {
      url: req.url,
      method: req.method,
      hasNextUrl: 'nextUrl' in req,
      nextUrlType: typeof (req as any).nextUrl,
      nextUrlValue: null as string | null,
      nextUrlSearchParams: null as string | null,
    },
    auth: {
      called: false,
      success: false,
      error: null as string | null,
      session: null as unknown,
    },
  };

  // Check nextUrl
  try {
    if ((req as any).nextUrl) {
      diagnostics.request.nextUrlValue = String((req as any).nextUrl);
      diagnostics.request.nextUrlSearchParams = (req as any).nextUrl.searchParams?.toString() ?? 'undefined';
    } else {
      diagnostics.request.nextUrlValue = 'UNDEFINED';
    }
  } catch (e) {
    diagnostics.request.nextUrlValue = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Test auth() call
  try {
    diagnostics.auth.called = true;
    const session = await auth();
    diagnostics.auth.success = true;
    diagnostics.auth.session = session ? { hasUser: !!session.user, email: session.user?.email } : null;
  } catch (e) {
    diagnostics.auth.success = false;
    diagnostics.auth.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }

  console.log('[DEBUG AUTH TEST]', JSON.stringify(diagnostics, null, 2));

  return NextResponse.json(diagnostics);
}
