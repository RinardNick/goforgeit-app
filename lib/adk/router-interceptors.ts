import { NextRequest } from 'next/server';

/**
 * ADK Router Interceptors
 *
 * These hooks allow us to intercept ADK requests/responses for:
 * - Dual-write to PostgreSQL
 * - Metrics tracking
 * - Custom logging
 * - Analytics
 *
 * All hooks are async to support future database writes.
 */

export interface BeforeProxyContext {
  req: NextRequest;
  path: string;
  method: string;
  body?: string | FormData;
}

export interface AfterProxyContext {
  req: NextRequest;
  path: string;
  method: string;
  response: Response;
  durationMs: number;
}

export interface ProxyErrorContext {
  req: NextRequest;
  path: string;
  method: string;
  error: Error;
}

/**
 * Called before proxying request to ADK backend
 *
 * Future use cases:
 * - Log request details
 * - Track API usage metrics
 * - Validate requests
 */
export async function beforeProxy(context: BeforeProxyContext): Promise<void> {
  // Hook is called but does nothing for now
  // Future: await db.logRequest(context)
}

/**
 * Called after receiving response from ADK backend
 *
 * Future use cases:
 * - Dual-write responses to PostgreSQL
 * - Track response times
 * - Log successful operations
 * - Cache responses
 */
export async function afterProxy(context: AfterProxyContext): Promise<void> {
  // Hook is called but does nothing for now
  // Future: await db.cacheResponse(context)
}

/**
 * Called when ADK backend request fails
 *
 * Future use cases:
 * - Log errors to database
 * - Send alerts
 * - Track failure rates
 * - Implement fallback logic
 */
export async function onProxyError(context: ProxyErrorContext): Promise<void> {
  // Hook is called but does nothing for now
  // Future: await db.logError(context)
}
