import { query, queryOne } from '../lib/db/client';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const USER_EMAIL = 'nickarinard@gmail.com';

async function main() {
  console.log(`Adopting system agents for ${USER_EMAIL}...`);

  // 1. Get Org
  const userQuery = await queryOne(
    `SELECT u.id, om.org_id 
     FROM "User" u
     JOIN organization_members om ON u.id = om.user_id
     WHERE u.email = $1
     LIMIT 1`,
    [USER_EMAIL]
  );

  if (!userQuery) {
    console.error('User or Organization not found. Please log in first.');
    process.exit(1);
  }

  const orgId = userQuery.org_id;
  const userId = userQuery.id;
  console.log(`Found Org ID: ${orgId}`);

  // 2. Create "System Core" Project
  let project = await queryOne(
    `SELECT id FROM projects WHERE org_id = $1 AND name = 'System Core'`,
    [orgId]
  );

  if (!project) {
    console.log('Creating "System Core" project...');
    project = await queryOne(
      `INSERT INTO projects (name, description, org_id) 
       VALUES ('System Core', 'Core infrastructure agents', $1) 
       RETURNING id`,
      [orgId]
    );
  }
  const projectId = project.id;

  // 3. Adopt Agents
  const agents = [
    {
      name: 'builder_agent',
      class: 'LlmAgent',
      description: 'The Meta-Agent Architect that builds other agents.'
    },
    {
      name: 'forge_agent',
      class: 'LlmAgent',
      description: 'Specialized Python tool creator.'
    }
  ];

  for (const agent of agents) {
    const existing = await queryOne(
      `SELECT id FROM agents WHERE org_id = $1 AND name = $2`,
      [orgId, agent.name]
    );

    if (existing) {
      console.log(`Updating ${agent.name}...`);
      await query(
        `UPDATE agents SET project_id = $1, description = $2, updated_at = NOW() WHERE id = $3`,
        [projectId, agent.description, existing.id]
      );
    } else {
      console.log(`Inserting ${agent.name}...`);
      await query(
        `INSERT INTO agents (name, description, org_id, project_id)
         VALUES ($1, $2, $3, $4)`,
        [agent.name, agent.description, orgId, projectId]
      );
    }
  }

  console.log('✅ System agents adopted successfully.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
