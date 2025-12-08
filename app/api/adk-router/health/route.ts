import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ADK_BACKEND_URL = process.env.ADK_BACKEND_URL || 'http://127.0.0.1:8000';

/**
 * ADK Router Health Check Endpoint
 *
 * Returns health status of the router and ADK backend.
 * Useful for monitoring and debugging.
 */
export async function GET() {
  // Check ADK backend health
  let backendStatus = 'unhealthy';
  try {
    const response = await fetch(`${ADK_BACKEND_URL}/list-apps`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    backendStatus = response.ok ? 'healthy' : 'unhealthy';
  } catch {
    backendStatus = 'unhealthy';
  }

  return NextResponse.json({
    router: {
      status: 'healthy',
    },
    backend: {
      status: backendStatus,
      url: ADK_BACKEND_URL,
    },
    timestamp: Date.now(),
  });
}
