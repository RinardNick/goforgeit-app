import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const KEY_LENGTH = 32; // 256 bits

export interface EncryptedKeyData {
  encryptedKey: string; // base64
  iv: string; // base64
  authTag: string; // base64
}

export interface KeyDisplayInfo {
  prefix: string;
  suffix: string;
}

function getEncryptionKey(): Buffer {
  const secret = process.env.PROVIDER_KEY_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('PROVIDER_KEY_SECRET environment variable must be at least 32 characters');
  }
  // Use SHA-256 hash for consistent key derivation
  return crypto.createHash('sha256').update(secret).digest().subarray(0, KEY_LENGTH);
}

/**
 * Encrypt an API key using AES-256-GCM
 */
export function encryptApiKey(plainKey: string): EncryptedKeyData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plainKey, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  return {
    encryptedKey: encrypted,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

/**
 * Decrypt an API key using AES-256-GCM
 */
export function decryptApiKey(data: EncryptedKeyData): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(data.iv, 'base64');
  const authTag = Buffer.from(data.authTag, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(data.encryptedKey, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Extract display info without exposing the full key
 */
export function getKeyDisplayInfo(plainKey: string): KeyDisplayInfo {
  const minLength = 8;
  if (plainKey.length < minLength) {
    return {
      prefix: plainKey.slice(0, 2),
      suffix: plainKey.slice(-2),
    };
  }
  return {
    prefix: plainKey.slice(0, 4),
    suffix: plainKey.slice(-4),
  };
}

/**
 * Format a masked key for display: "sk-pr...suff"
 */
export function formatMaskedKey(prefix: string, suffix: string): string {
  return `${prefix}...${suffix}`;
}

/**
 * Validate key format based on provider
 */
export function validateKeyFormat(provider: string, key: string): { valid: boolean; error?: string } {
  const trimmedKey = key.trim();

  if (!trimmedKey) {
    return { valid: false, error: 'API key cannot be empty' };
  }

  switch (provider) {
    case 'openai':
      // OpenAI keys start with sk-
      if (!trimmedKey.startsWith('sk-')) {
        return { valid: false, error: 'OpenAI API keys should start with "sk-"' };
      }
      if (trimmedKey.length < 20) {
        return { valid: false, error: 'OpenAI API key seems too short' };
      }
      break;

    case 'anthropic':
      // Anthropic keys start with sk-ant-
      if (!trimmedKey.startsWith('sk-ant-')) {
        return { valid: false, error: 'Anthropic API keys should start with "sk-ant-"' };
      }
      break;

    case 'google':
      // Google/Gemini API keys are typically 39 chars starting with AIza
      if (!trimmedKey.startsWith('AIza')) {
        return { valid: false, error: 'Google API keys should start with "AIza"' };
      }
      if (trimmedKey.length < 30) {
        return { valid: false, error: 'Google API key seems too short' };
      }
      break;

    default:
      return { valid: false, error: `Unknown provider: ${provider}` };
  }

  return { valid: true };
}
