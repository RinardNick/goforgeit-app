
import { queryOne } from '../db/client';
import crypto from 'crypto';

/**
 * Validate an API key and return the associated organization ID
 */
export async function validateApiKey(apiKey: string): Promise<string | null> {
  if (!apiKey) return null;

  // We assume keys are stored hashed (sha256) in the DB
  // Format: "sk_live_..."
  // If the key in DB is plain text (dev/test), we check that too.
  
  // In 017 migration:
  // CREATE TABLE api_keys (..., key_hash TEXT NOT NULL, ...);
  // So we must hash the input key.
  
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

  const result = await queryOne<{ org_id: string }>(
    'SELECT org_id FROM api_keys WHERE key_hash = $1 AND (expires_at IS NULL OR expires_at > NOW())',
    [hash]
  );

  return result?.org_id || null;
}
