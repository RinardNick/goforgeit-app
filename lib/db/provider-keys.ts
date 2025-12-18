import { query, queryOne } from './client';
import {
  encryptApiKey,
  decryptApiKey,
  getKeyDisplayInfo,
  formatMaskedKey,
  EncryptedKeyData,
} from '../crypto/provider-keys';

export type Provider = 'google' | 'openai' | 'anthropic';

export interface ProviderKeyInfo {
  provider: Provider;
  label: string | null;
  maskedKey: string;
  isValid: boolean;
  lastValidatedAt: string | null;
  createdAt: string;
}

export interface ProviderKeyRow {
  id: string;
  org_id: string;
  provider: Provider;
  encrypted_key: string;
  key_iv: string;
  key_auth_tag: string;
  key_suffix: string;
  key_prefix: string;
  label: string | null;
  is_valid: boolean;
  last_validated_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * List all provider keys for an organization (returns masked info only)
 */
export async function listProviderKeys(orgId: string): Promise<ProviderKeyInfo[]> {
  const rows = await query<ProviderKeyRow>(
    `SELECT provider, label, key_prefix, key_suffix, is_valid, last_validated_at, created_at
     FROM provider_api_keys
     WHERE org_id = $1
     ORDER BY provider`,
    [orgId]
  );

  return rows.map((row) => ({
    provider: row.provider,
    label: row.label,
    maskedKey: formatMaskedKey(row.key_prefix, row.key_suffix),
    isValid: row.is_valid,
    lastValidatedAt: row.last_validated_at,
    createdAt: row.created_at,
  }));
}

/**
 * Get a specific provider key (decrypted) for internal use only
 */
export async function getProviderKey(orgId: string, provider: Provider): Promise<string | null> {
  const row = await queryOne<ProviderKeyRow>(
    `SELECT encrypted_key, key_iv, key_auth_tag
     FROM provider_api_keys
     WHERE org_id = $1 AND provider = $2`,
    [orgId, provider]
  );

  if (!row) return null;

  const encryptedData: EncryptedKeyData = {
    encryptedKey: row.encrypted_key,
    iv: row.key_iv,
    authTag: row.key_auth_tag,
  };

  return decryptApiKey(encryptedData);
}

/**
 * Get all provider keys for an organization (decrypted) - for ADK injection
 */
export async function getOrgProviderKeys(orgId: string): Promise<Map<Provider, string>> {
  const rows = await query<ProviderKeyRow>(
    `SELECT provider, encrypted_key, key_iv, key_auth_tag
     FROM provider_api_keys
     WHERE org_id = $1`,
    [orgId]
  );

  const keys = new Map<Provider, string>();

  for (const row of rows) {
    try {
      const encryptedData: EncryptedKeyData = {
        encryptedKey: row.encrypted_key,
        iv: row.key_iv,
        authTag: row.key_auth_tag,
      };
      keys.set(row.provider, decryptApiKey(encryptedData));
    } catch (error) {
      console.error(`[ProviderKeys] Failed to decrypt ${row.provider} key:`, error);
    }
  }

  return keys;
}

/**
 * Upsert a provider key (create or update)
 */
export async function upsertProviderKey(
  orgId: string,
  provider: Provider,
  apiKey: string,
  userId: string | null,
  label?: string
): Promise<ProviderKeyInfo> {
  const encrypted = encryptApiKey(apiKey);
  const displayInfo = getKeyDisplayInfo(apiKey);

  const row = await queryOne<ProviderKeyRow>(
    `INSERT INTO provider_api_keys
     (org_id, provider, encrypted_key, key_iv, key_auth_tag, key_prefix, key_suffix, label, created_by, is_valid, last_validated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, NOW())
     ON CONFLICT (org_id, provider)
     DO UPDATE SET
       encrypted_key = EXCLUDED.encrypted_key,
       key_iv = EXCLUDED.key_iv,
       key_auth_tag = EXCLUDED.key_auth_tag,
       key_prefix = EXCLUDED.key_prefix,
       key_suffix = EXCLUDED.key_suffix,
       label = COALESCE(EXCLUDED.label, provider_api_keys.label),
       is_valid = TRUE,
       last_validated_at = NOW(),
       updated_at = NOW()
     RETURNING *`,
    [
      orgId,
      provider,
      encrypted.encryptedKey,
      encrypted.iv,
      encrypted.authTag,
      displayInfo.prefix,
      displayInfo.suffix,
      label || null,
      userId,
    ]
  );

  if (!row) {
    throw new Error('Failed to upsert provider key');
  }

  return {
    provider: row.provider,
    label: row.label,
    maskedKey: formatMaskedKey(row.key_prefix, row.key_suffix),
    isValid: row.is_valid,
    lastValidatedAt: row.last_validated_at,
    createdAt: row.created_at,
  };
}

/**
 * Delete a provider key
 */
export async function deleteProviderKey(orgId: string, provider: Provider): Promise<boolean> {
  const result = await query(
    `DELETE FROM provider_api_keys WHERE org_id = $1 AND provider = $2`,
    [orgId, provider]
  );
  return true;
}

/**
 * Update validation status of a key
 */
export async function updateKeyValidationStatus(
  orgId: string,
  provider: Provider,
  isValid: boolean
): Promise<void> {
  await query(
    `UPDATE provider_api_keys
     SET is_valid = $1, last_validated_at = NOW(), updated_at = NOW()
     WHERE org_id = $2 AND provider = $3`,
    [isValid, orgId, provider]
  );
}

/**
 * Check if an organization has any provider keys configured
 */
export async function hasAnyProviderKeys(orgId: string): Promise<boolean> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM provider_api_keys WHERE org_id = $1`,
    [orgId]
  );
  return result ? parseInt(result.count) > 0 : false;
}
