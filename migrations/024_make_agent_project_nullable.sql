-- Make project_id nullable in agents table to allow unorganized agents
ALTER TABLE agents ALTER COLUMN project_id DROP NOT NULL;
