-- Migration 023: Add unique constraint on projects(name, org_id)
-- This is required for ON CONFLICT (name, org_id) to work in the agents API

-- Add unique constraint (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'projects_name_org_id_unique'
  ) THEN
    ALTER TABLE projects ADD CONSTRAINT projects_name_org_id_unique UNIQUE (name, org_id);
  END IF;
END $$;
