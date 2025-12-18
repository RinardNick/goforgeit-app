-- Create Agents table to track ADK Apps within Projects
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- The folder name in ADK (e.g., 'marketing_bot')
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure agent names are unique within an organization (or globally if ADK requires it)
  -- ADK flat folder structure requires global uniqueness of folder names currently
  CONSTRAINT unique_agent_name UNIQUE (name) 
);

-- Clean up the misuse of 'projects' table from previous step
-- We will move existing entries in 'projects' to 'agents' (linked to a default project)
-- But first, we need to ensure at least one project exists for migration
DO $$
DECLARE
  default_project_id UUID;
  rec RECORD;
BEGIN
  -- If there are entries in 'projects' that look like agents (from my previous step)
  IF EXISTS (SELECT 1 FROM projects) THEN
    -- 1. Create a "Default Project" for each organization that has "agents" currently in the projects table
    FOR rec IN SELECT DISTINCT org_id FROM projects LOOP
      INSERT INTO projects (org_id, name, description)
      VALUES (rec.org_id, 'Default Project', 'Auto-created for existing agents')
      RETURNING id INTO default_project_id;

      -- 2. Move existing "projects" (which are actually agents) to the 'agents' table
      INSERT INTO agents (org_id, project_id, name)
      SELECT org_id, default_project_id, name
      FROM projects
      WHERE org_id = rec.org_id;
      
      -- 3. Delete the moved rows from projects table
      -- Note: This is tricky because we are modifying the table we are looping over logic-wise
      -- Simpler: We will truncate projects table after migration since we just created a new Default Project
    END LOOP;
    
    -- Clear the table (except the new Default Projects we just made? No, easier to just wipe and re-insert properly)
    -- Actually, safer strategy:
    -- The previous step inserted agents. 
    -- Now we need to keep only the "Default Project" rows in the projects table.
    -- Since 'agents' table is populated, we can clean up 'projects'.
    
    DELETE FROM projects WHERE name != 'Default Project';
  END IF;
END $$;
