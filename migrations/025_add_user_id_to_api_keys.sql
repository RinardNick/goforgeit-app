-- Migration 025: Add user_id to api_keys table
-- Description: Links API keys to specific users for ownership tracking and access control

-- Add user_id column as a foreign key to User table
ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES "User"(id) ON DELETE CASCADE;

-- Create index for efficient user lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

-- Backfill: Set user_id from created_by if it's a valid UUID
-- (created_by was stored as TEXT, user IDs are UUIDs)
UPDATE api_keys
SET user_id = created_by::uuid
WHERE created_by IS NOT NULL
  AND created_by ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND user_id IS NULL;

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE api_keys TO admin_app;

-- Comments
COMMENT ON COLUMN api_keys.user_id IS 'User who owns this API key (for access control and filtering)';
