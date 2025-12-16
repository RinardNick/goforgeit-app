-- Migration 020: Drop unused agent_configs and agent_templates tables
-- 
-- These tables were created in migrations 011 and 012 for PostgreSQL-based agent storage
-- but are no longer used since we switched to GCS bucket storage (2025-11-22).
--
-- Background:
-- - ADK Visual Builder saves agents to GCS bucket (nicholasrinard-adk-agents/*.yaml)
-- - The admin UI now queries GCS directly via /api/agents endpoints
-- - PostgreSQL tables created a disconnected storage system that didn't work with ADK
--
-- This migration cleans up the unused tables.

-- Drop agent_templates table (created in migration 012)
DROP TABLE IF EXISTS agent_templates CASCADE;

-- Drop agent_configs table (created in migration 011)
DROP TABLE IF EXISTS agent_configs CASCADE;

-- Note: If you need to restore these tables for any reason, you can re-run
-- migrations 011 and 012. However, they are not compatible with the current
-- GCS-based agent storage architecture.
