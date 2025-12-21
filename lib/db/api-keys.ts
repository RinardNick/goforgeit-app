
import { query, queryOne } from './client';
import crypto from 'crypto';

export interface ApiKey {
  id: string;
  name: string;
  description?: string;
  key_prefix: string;
  scoped_agents: string[] | null;
  org_id: string;
  created_at: Date;
  last_used_at?: Date;
  revoked_at?: Date;
}

export interface CreateApiKeyParams {
  name: string;
  userId: string;
  orgId: string;
  scopedAgents?: string[]; // null or empty means org-wide
  description?: string;
}

export interface CreateApiKeyResult extends Omit<ApiKey, 'scoped_agents' | 'org_id' | 'key_prefix' | 'key_hash'> {
  apiKey: string; // The full raw key (only returned once)
  scopedAgents: string[] | null;
}

/**
 * Generate a new API key
 * Format: sk_live_<24 random chars>
 */
function generateKey(): string {
  return `sk_live_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Create a new API key with optional agent scoping
 */
export async function createApiKey(params: CreateApiKeyParams): Promise<CreateApiKeyResult> {
  const apiKey = generateKey();
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const keyPrefix = apiKey.substring(0, 8) + '...';

  // Ensure scopedAgents is stored as UUID array or NULL
  const scopedAgents = params.scopedAgents && params.scopedAgents.length > 0 
    ? params.scopedAgents 
    : null;

  const sql = `
    INSERT INTO api_keys (
      name, 
      description, 
      key_hash, 
      key_prefix, 
      org_id, 
      created_by, 
      scoped_agents
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, name, description, created_at, scoped_agents
  `;

  const result = await queryOne<any>(sql, [
    params.name,
    params.description || null,
    keyHash,
    keyPrefix,
    params.orgId,
    params.userId,
    scopedAgents
  ]);

  if (!result) {
    throw new Error('Failed to create API key');
  }

  return {
    id: result.id,
    name: result.name,
    description: result.description,
    created_at: result.created_at,
    scopedAgents: result.scoped_agents,
    apiKey // Return the full key only here
  };
}

/**
 * List API keys for an organization
 */
export async function listApiKeys(orgId: string): Promise<ApiKey[]> {
  const sql = `
    SELECT 
      id, name, description, key_prefix, scoped_agents, org_id, 
      created_at, last_used_at, revoked_at 
    FROM api_keys 
    WHERE org_id = $1 
    ORDER BY created_at DESC
  `;
  
  return query<ApiKey>(sql, [orgId]);
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId: string, userId: string): Promise<void> {
  const sql = `
    UPDATE api_keys 
    SET revoked_at = NOW(), revoked_by = $2 
    WHERE id = $1
  `;
  
  await query(sql, [keyId, userId]);
}

/**
 * Get a single API key by ID (metadata only)
 */
export async function getApiKey(keyId: string, orgId: string): Promise<ApiKey | null> {
  const sql = `
    SELECT 
      id, name, description, key_prefix, scoped_agents, org_id, 
      created_at, last_used_at, revoked_at 
    FROM api_keys 
    WHERE id = $1 AND org_id = $2
  `;
  
  return queryOne<ApiKey>(sql, [keyId, orgId]);
}
