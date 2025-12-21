import { NextRequest, NextResponse } from 'next/server';
import { beforeProxy, afterProxy, onProxyError } from '@/lib/adk/router-interceptors';
import { getOrgProviderKeys } from '@/lib/db/provider-keys';

export const runtime = 'nodejs';

const ADK_BACKEND_URL = process.env.ADK_BACKEND_URL || 'http://127.0.0.1:8000';

/**
 * ADK Router - Abstraction layer for Google ADK backend
 *
 * This router sits between our application and the ADK backend,
 * providing a single control point for all ADK communication.
 *
 * Initially: Pure pass-through proxy (no behavior changes)
 * Future: Can add dual-write, caching, metrics, etc.
 */

async function proxyToADK(
  req: NextRequest,
  params: { path: string[] }
): Promise<Response> {
  const startTime = Date.now();

  // Reconstruct target URL
  const adkPath = params.path.join('/');
  const targetUrl = `${ADK_BACKEND_URL}/${adkPath}${req.nextUrl.search}`;

  // Log request
  console.log(`[ADK Router] ${req.method} /${adkPath}`);

  // Copy headers (exclude host, connection, content-length, transfer-encoding)
  // Note: fetch() will automatically set content-length for the new body
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!['host', 'connection', 'content-length', 'transfer-encoding'].includes(lowerKey)) {
      headers[key] = value;
    }
  });

  // Inject provider API keys from org settings
  const orgId = req.headers.get('x-org-id');
  if (orgId) {
    try {
      const providerKeys = await getOrgProviderKeys(orgId);
      if (providerKeys.has('google')) {
        headers['x-google-api-key'] = providerKeys.get('google')!;
      }
      if (providerKeys.has('openai')) {
        headers['x-openai-api-key'] = providerKeys.get('openai')!;
      }
      if (providerKeys.has('anthropic')) {
        headers['x-anthropic-api-key'] = providerKeys.get('anthropic')!;
      }
    } catch (error) {
      console.error('[ADK Router] Failed to fetch provider keys:', error);
    }
  }

  // Extract body for non-GET/HEAD requests
  let body: BodyInit | undefined;
  if (!['GET', 'HEAD'].includes(req.method)) {
    const contentType = req.headers.get('content-type') || '';

    try {
      if (contentType.includes('application/json')) {
        const jsonData = await req.json();
        body = JSON.stringify(jsonData);
      } else if (contentType.includes('multipart/form-data')) {
        body = await req.formData();
      } else {
        body = await req.text();
      }
    } catch (error) {
      // If body parsing fails, continue without body
      console.warn(`[ADK Router] Failed to parse body:`, error);
    }
  }

  try {
    console.log(`[ADK Router] → ${req.method} ${targetUrl}`);

    // Call beforeProxy hook
    await beforeProxy({
      req,
      path: adkPath,
      method: req.method,
      body: typeof body === 'string' ? body : undefined,
    });

    // Proxy to ADK backend
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const durationMs = Date.now() - startTime;
    const emoji = response.ok ? '✓' : '✗';
    console.log(`[ADK Router] ${emoji} ${response.status} (${durationMs}ms)`);

    // Handle streaming responses (SSE)
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      // Call afterProxy hook for SSE responses
      // IMPORTANT: Clone response so interceptor can read stream without consuming original
      const responseClone = response.clone();
      
      // Fire and forget (don't await) so we don't delay the stream start
      afterProxy({
        req,
        path: adkPath,
        method: req.method,
        response: responseClone,
        durationMs,
        requestBody: typeof body === 'string' ? body : undefined,
      }).catch(err => console.error('[ADK Router] afterProxy hook failed:', err));

      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Handle JSON responses
    let responseBody: string;
    if (contentType.includes('application/json')) {
      const jsonData = await response.json();
      responseBody = JSON.stringify(jsonData);
    } else {
      responseBody = await response.text();
    }

    // Copy response headers
    const responseHeaders: HeadersInit = {};
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'transfer-encoding') {
        responseHeaders[key] = value;
      }
    });

    // Call afterProxy hook
    // Create a fresh Response object because the original body was consumed above
    const freshResponse = new Response(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });

    await afterProxy({
      req,
      path: adkPath,
      method: req.method,
      response: freshResponse,
      durationMs,
      requestBody: typeof body === 'string' ? body : undefined,
    });

    return new NextResponse(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`[ADK Router] ✗ ERROR ${req.method} /${adkPath}:`, error instanceof Error ? error.message : 'Unknown error');

    // Call onProxyError hook
    await onProxyError({
      req,
      path: adkPath,
      method: req.method,
      error: error instanceof Error ? error : new Error('Unknown error'),
    });

    return NextResponse.json(
      {
        error: 'ADK backend unavailable',
        details: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Make sure ADK server is running: make dev-adk',
      },
      { status: 503 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyToADK(req, await params);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyToADK(req, await params);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyToADK(req, await params);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyToADK(req, await params);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyToADK(req, await params);
}
