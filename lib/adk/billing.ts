
import { query, queryOne } from '@/lib/db/client';
import { getModelPricing } from '@/lib/pricing';

export interface BillingResult {
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  model?: string;
}

/**
 * Calculate billing from response
 * 
 * Handles both JSON and SSE stream formats.
 * For SSE, it looks for the last event with usageMetadata.
 */
export async function calculateBilling(response: Response): Promise<BillingResult | null> {
  // If body is already used, we can't read it.
  // The router should pass a fresh Response object if it already consumed the body.
  if (response.bodyUsed) {
    console.warn('[Billing] Response body already used, cannot calculate billing');
    return null;
  }

  // Clone to avoid consuming the original stream if it's being returned to user
  // However, teeing a stream has overhead.
  let text = '';
  try {
    text = await response.text();
  } catch (e) {
    console.error('[Billing] Failed to read response text:', e);
    return null;
  }

  let totalTokens = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let model: string | undefined;

  // 1. Try parsing as full JSON object
  try {
    const data = JSON.parse(text);
    
    // Handle Array (non-streaming /run response returns list of events)
    if (Array.isArray(data)) {
      for (const event of data) {
        if (event.usageMetadata) {
          console.log('[Billing Debug] usageMetadata (Array):', JSON.stringify(event.usageMetadata));
          totalTokens = Math.max(totalTokens, event.usageMetadata.totalTokenCount || 0);
          promptTokens = Math.max(promptTokens, event.usageMetadata.promptTokenCount || 0);
          completionTokens = Math.max(completionTokens, event.usageMetadata.candidatesTokenCount || 0);
        }
        if (event.modelVersion) {
          model = event.modelVersion;
        }
      }
    } 
    // Handle Single Object
    else if (data.usageMetadata) {
      console.log('[Billing Debug] usageMetadata (Object):', JSON.stringify(data.usageMetadata));
      totalTokens = data.usageMetadata.totalTokenCount || 0;
      promptTokens = data.usageMetadata.promptTokenCount || 0;
      completionTokens = data.usageMetadata.candidatesTokenCount || 0;
      model = data.modelVersion;
    }
    
    if (totalTokens > 0) {
      const pricing = getModelPricing(model || 'gemini-2.0-flash-exp');
      const cost = (promptTokens / 1000000 * pricing.inputPrice) + (completionTokens / 1000000 * pricing.outputPrice);
      return {
        tokens: totalTokens,
        promptTokens,
        completionTokens,
        cost,
        model
      };
    }
  } catch {
    // Not a single JSON object or Array
  }

  // 2. Try parsing as SSE stream
  // Format: data: {...}\n\n
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const jsonStr = line.slice(6);
        if (jsonStr.trim() === '[DONE]') continue;
        
        const eventData = JSON.parse(jsonStr);
        
        if (eventData.usageMetadata) {
          console.log('[Billing Debug] usageMetadata (SSE):', JSON.stringify(eventData.usageMetadata));
          // Track the maximum token count seen (it usually accumulates)
          if (eventData.usageMetadata.totalTokenCount) {
            totalTokens = Math.max(totalTokens, eventData.usageMetadata.totalTokenCount);
          }
          promptTokens = Math.max(promptTokens, eventData.usageMetadata.promptTokenCount || 0);
          completionTokens = Math.max(completionTokens, eventData.usageMetadata.candidatesTokenCount || 0);
        }
        
        if (eventData.modelVersion) {
          model = eventData.modelVersion;
        }
      } catch {
        // Ignore invalid lines
      }
    }
  }

  if (totalTokens > 0) {
    const pricing = getModelPricing(model || 'gemini-2.0-flash-exp');
    const cost = (promptTokens / 1000000 * pricing.inputPrice) + (completionTokens / 1000000 * pricing.outputPrice);
    return {
      tokens: totalTokens,
      promptTokens,
      completionTokens,
      cost,
      model
    };
  }

  console.log('[Billing] No tokens found. Response sample:', text.slice(0, 200));
  return null;
}

/**
 * Log billing transaction to database
 */
export async function logTokenUsage(
  orgId: string | undefined, 
  userId: string | undefined, 
  usage: BillingResult,
  appName?: string
): Promise<void> {
  try {
    // Resolve email to UUID if needed
    let finalUserId = userId;
    if (userId && userId.includes('@')) {
      const user = await queryOne<{id: string}>('SELECT id FROM "User" WHERE email = $1', [userId]);
      if (user) finalUserId = user.id;
    }

    await query(
      `INSERT INTO billing_ledger 
       (org_id, user_id, transaction_type, amount, currency, metadata)
       VALUES ($1, $2, 'usage', $3, 'USD', $4)`,
      [
        orgId || null, 
        finalUserId || null, 
        usage.cost, 
        JSON.stringify({ 
          tokens: usage.tokens, 
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          model: usage.model,
          service: 'adk-agent',
          agent: appName
        })
      ]
    );
    console.log(`[Billing] Logged usage for ${appName || 'unknown'}: ${usage.tokens} tokens (In: ${usage.promptTokens}, Out: ${usage.completionTokens})`);
  } catch (error) {
    console.error('[Billing] Failed to log usage:', error);
  }
}
