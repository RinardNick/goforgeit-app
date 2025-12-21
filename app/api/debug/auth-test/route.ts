import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export const runtime = 'nodejs';

interface DiagnosticResult {
  timestamp: string;
  environment: {
    NODE_ENV: string | undefined;
    AUTH_URL: string;
    AUTH_SECRET: string;
  };
  request: {
    url: string;
    method: string;
    hasNextUrl: boolean;
    nextUrlType: string;
    nextUrlValue: string | null;
    nextUrlSearchParams: string | null;
  };
  auth: {
    called: boolean;
    success: boolean;
    error: string | null;
    session: { hasUser: boolean; email: string | null | undefined } | null;
  };
}

/**
 * Diagnostic endpoint to debug auth issues in Cloud Run
 * This endpoint logs request state and auth behavior
 */
export async function GET(req: NextRequest) {
  const diagnostics: DiagnosticResult = {
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
      nextUrlType: typeof (req as unknown as { nextUrl?: unknown }).nextUrl,
      nextUrlValue: null,
      nextUrlSearchParams: null,
    },
    auth: {
      called: false,
      success: false,
      error: null,
      session: null,
    },
  };

  // Check nextUrl
  try {
    const reqAny = req as unknown as { nextUrl?: { toString(): string; searchParams?: { toString(): string } } };
    if (reqAny.nextUrl) {
      diagnostics.request.nextUrlValue = String(reqAny.nextUrl);
      diagnostics.request.nextUrlSearchParams = reqAny.nextUrl.searchParams?.toString() ?? 'undefined';
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
