import { NextRequest } from 'next/server';
import { calculateBilling, logTokenUsage } from './billing';

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
  requestBody?: string;
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
  console.log('[Interceptor] afterProxy called for', context.path);
  try {
    // 1. Calculate billing from response
    // Note: calculateBilling handles cloning/stream reading safely
    console.log('[Interceptor] Calculating billing...');
    const billing = await calculateBilling(context.response);
    console.log('[Interceptor] Billing result:', billing);
    
    if (billing) {
      // 2. Extract userId/orgId/appName
      let userId: string | undefined;
      let orgId: string | undefined;
      let appName: string | undefined;
      
      console.log('[Interceptor] Headers:', Object.fromEntries(context.req.headers.entries()));
      
      // Try to get data from JSON body
      if (context.requestBody) {
         try {
           const body = JSON.parse(context.requestBody);
           userId = body.user_id;
           appName = body.app_name;
         } catch {
           // Ignore parse errors
         }
      }
      
      // Fallback: Try headers for user/org
      if (!userId) {
        userId = context.req.headers.get('x-user-id') || undefined;
      }
      orgId = context.req.headers.get('x-org-id') || undefined;

      // Fallback: Extract appName from path if not in body
      // Path format: apps/{appName}/...
      if (!appName) {
        const match = context.path.match(/^apps\/([^/]+)/);
        if (match) {
          appName = match[1];
        }
      }
      
      console.log('[Interceptor] Extracted userId:', userId, 'orgId:', orgId, 'appName:', appName);

      // 3. Log to DB
      // We don't await this to keep the response fast (fire-and-forget logic was moved to caller for streams, 
      // but here we are inside the async hook, so we can await or not. 
      // Since route.ts awaits afterProxy for non-streams, we should probably NOT await the DB write 
      // if we want to return quickly, OR we accept the slight delay for data integrity.
      // Given "Money Path", data integrity > ms latency. We await.
      await logTokenUsage(orgId, userId, billing, appName);
    }
  } catch (error) {
    console.error('[Router Interceptor] Failed to process billing:', error);
  }
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
