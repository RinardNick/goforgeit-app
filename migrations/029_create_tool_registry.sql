-- Migration: Create Tool Registry
-- Purpose: Centralized repository for reusable tools and MCP servers

-- Check if type exists before creating
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tool_type') THEN
        CREATE TYPE tool_type AS ENUM ('CUSTOM', 'MCP');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS tool_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    type tool_type NOT NULL,
    config JSONB NOT NULL, -- Stores file path for CUSTOM, or URL/Config for MCP
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    source_project_id UUID REFERENCES projects(id) ON DELETE SET NULL, -- Where it was originally created
    category TEXT, -- AI-assigned category
    tags JSONB DEFAULT '[]'::JSONB, -- AI-assigned tags
    is_public BOOLEAN DEFAULT FALSE, -- Future-proofing for public marketplace
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast searching
CREATE INDEX IF NOT EXISTS idx_tool_registry_org_id ON tool_registry(org_id);
CREATE INDEX IF NOT EXISTS idx_tool_registry_type ON tool_registry(type);
CREATE INDEX IF NOT EXISTS idx_tool_registry_category ON tool_registry(category);
