-- Migration 027: Provider API Keys for LLM Access
-- Per-organization encrypted API keys for LLM providers (Google, OpenAI, Anthropic)

CREATE TABLE IF NOT EXISTS provider_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'openai', 'anthropic')),

  -- Encrypted key storage (AES-256-GCM)
  encrypted_key TEXT NOT NULL,
  key_iv TEXT NOT NULL,
  key_auth_tag TEXT NOT NULL,

  -- Display info (non-sensitive)
  key_suffix TEXT NOT NULL,
  key_prefix TEXT NOT NULL,

  -- Metadata
  label TEXT,
  is_valid BOOLEAN DEFAULT TRUE,
  last_validated_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  created_by UUID REFERENCES "User"(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One key per provider per org
  UNIQUE(org_id, provider)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_provider_api_keys_org_id ON provider_api_keys(org_id);

-- Comments
COMMENT ON TABLE provider_api_keys IS 'Encrypted LLM provider API keys per organization';
COMMENT ON COLUMN provider_api_keys.encrypted_key IS 'AES-256-GCM encrypted API key (base64)';
COMMENT ON COLUMN provider_api_keys.key_iv IS 'Initialization vector for decryption (base64)';
COMMENT ON COLUMN provider_api_keys.key_auth_tag IS 'GCM authentication tag (base64)';
