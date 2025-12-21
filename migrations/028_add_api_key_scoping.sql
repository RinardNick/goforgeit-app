-- Migration 028: Add API Key Scoping
-- Description: Adds scoped_agents column to api_keys table for granular access control.

-- Add scoped_agents column (UUID array)
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS scoped_agents UUID[];

COMMENT ON COLUMN api_keys.scoped_agents IS 'Array of Agent UUIDs this key is restricted to. If NULL, follows organization-wide access logic.';
