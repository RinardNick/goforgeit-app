import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Route through ADK router instead of directly to backend
// This ensures all requests benefit from router interceptors and logging
const ADK_ROUTER_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/adk-router`
  : 'http://localhost:3050/api/adk-router';

async function proxyRequest(
  req: NextRequest,
  params: { path: string[] }
) {
  const path = params.path.join('/');
  const url = new URL(req.url);
  const targetUrl = `${ADK_ROUTER_URL}/${path}${url.search}`;

  const headers: HeadersInit = {};
  req.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'connection') {
      headers[key] = value;
    }
  });

  try {
    let body: BodyInit | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        body = JSON.stringify(await req.json());
      } else if (contentType.includes('multipart/form-data')) {
        body = await req.formData();
      } else {
        body = await req.text();
      }
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const contentType = response.headers.get('content-type') || '';
    let responseBody: string | Buffer;

    if (contentType.includes('application/json')) {
      responseBody = JSON.stringify(await response.json());
    } else if (contentType.includes('text/event-stream')) {
      // For SSE (Server-Sent Events), we need to handle streaming
      const stream = response.body;
      if (stream) {
        return new Response(stream, {
          status: response.status,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }
      responseBody = '';
    } else {
      responseBody = await response.text();
    }

    const responseHeaders: HeadersInit = {};
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'transfer-encoding') {
        responseHeaders[key] = value;
      }
    });

    return new NextResponse(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('ADK proxy error:', error);
    return NextResponse.json(
      {
        error: 'ADK router unavailable',
        details: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Make sure the application and ADK server are running'
      },
      { status: 503 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, await params);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, await params);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, await params);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, await params);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, await params);
}
