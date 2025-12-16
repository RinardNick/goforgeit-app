-- Migration 017: API Keys for External Agent Access
-- Description: Creates tables for API key management and access logging

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT NOT NULL,
  description TEXT,
  key_hash TEXT NOT NULL UNIQUE, -- bcrypt hash of the actual key
  key_prefix TEXT NOT NULL, -- First 8 chars for display (e.g., "ak_12345...")
  permissions TEXT[] NOT NULL DEFAULT '{}', -- Array of permission scopes
  created_by TEXT, -- User ID (no foreign key due to type mismatch with User table)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by TEXT -- User ID (no foreign key due to type mismatch with User table)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_by ON api_keys(created_by);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_at ON api_keys(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked_at ON api_keys(revoked_at) WHERE revoked_at IS NULL;

-- API Key Access Log table
CREATE TABLE IF NOT EXISTS api_key_access_log (
  id SERIAL PRIMARY KEY,
  api_key_id TEXT REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  response_time_ms INTEGER
);

-- Indexes for log queries
CREATE INDEX IF NOT EXISTS idx_api_key_access_log_api_key_id ON api_key_access_log(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_access_log_requested_at ON api_key_access_log(requested_at DESC);

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE api_keys TO admin_app;
GRANT ALL PRIVILEGES ON TABLE api_key_access_log TO admin_app;
GRANT USAGE, SELECT ON SEQUENCE api_key_access_log_id_seq TO admin_app;

-- Comments for documentation
COMMENT ON TABLE api_keys IS 'API keys for external applications to access agents';
COMMENT ON COLUMN api_keys.key_hash IS 'Bcrypt hash of the full API key (never store plaintext)';
COMMENT ON COLUMN api_keys.key_prefix IS 'Display prefix for UI (e.g., ak_abc123...)';
COMMENT ON COLUMN api_keys.permissions IS 'Array of permission scopes (e.g., agents:list, agents:execute)';
COMMENT ON TABLE api_key_access_log IS 'Audit log of all API key usage';
