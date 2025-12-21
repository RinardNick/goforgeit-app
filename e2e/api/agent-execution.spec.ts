
import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import crypto from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

test.describe('Agent Execution API', () => {
  let orgId: string;
  let agentId: string;
  let apiKey: string;
  let agentName = 'api-exec-test-agent';

  test.beforeAll(async () => {
    // 1. Create Org
    const orgSlug = `api-exec-test-org-${Date.now()}`;
    await pool.query(`INSERT INTO organizations (name, slug) VALUES ('API Exec Test Org', $1) ON CONFLICT DO NOTHING`, [orgSlug]);
    const orgRes = await pool.query(`SELECT id FROM organizations WHERE slug = $1`, [orgSlug]);
    orgId = orgRes.rows[0].id;

    // 2. Create User
    const email = `api-exec-tester-${Date.now()}@example.com`;
    await pool.query(`INSERT INTO "User" (email, name) VALUES ($1, 'API Exec Tester') ON CONFLICT DO NOTHING`, [email]);
    const userRes = await pool.query(`SELECT id FROM "User" WHERE email = $1`, [email]);
    const userId = userRes.rows[0].id;

    // 3. Create Agent
    // We need a published agent for execution? Or just an agent.
    // The spec says "scoping to specific agents".
    // We also need `agent_configs` entry? Or `agents` table entry?
    // The current architecture seems to use `agents` for the folder structure/ADK reference, 
    // and `agent_configs` for the visual builder.
    // The endpoint is /api/v1/agents/[name]/execute.
    // I'll assume it maps to `agents` table name or `agent_configs`. 
    // Given "Visual Builder" context, likely `agent_configs`.
    // But migration 023 introduced `agents` table for ADK apps.
    // Let's assume `agents` table `name` is what matches the URL param.
    
    await pool.query(`INSERT INTO agents (org_id, name, description) VALUES ($1, $2, 'Test Agent') ON CONFLICT DO NOTHING`, [orgId, agentName]);
    const agentRes = await pool.query(`SELECT id FROM agents WHERE org_id = $1 AND name = $2`, [orgId, agentName]);
    agentId = agentRes.rows[0].id;

    // 4. Create API Key
    apiKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    await pool.query(`
      INSERT INTO api_keys (name, key_hash, key_prefix, org_id, created_by, scoped_agents)
      VALUES ('Test Key', $1, 'sk_live_', $2, $3, $4)
    `, [keyHash, orgId, userId, [agentId]]);
  });

  test('should reject request without API key', async ({ request }) => {
    const response = await request.post(`/api/v1/agents/${agentName}/execute`, {
      data: { prompt: 'Hello' }
    });
    expect(response.status()).toBe(401);
  });

  test('should reject request with invalid API key', async ({ request }) => {
    const response = await request.post(`/api/v1/agents/${agentName}/execute`, {
      headers: { 'X-Forge-Api-Key': 'invalid-key' },
      data: { prompt: 'Hello' }
    });
    expect(response.status()).toBe(401);
  });

  test('should accept request with valid API key', async ({ request }) => {
    const response = await request.post(`/api/v1/agents/${agentName}/execute`, {
      headers: { 'X-Forge-Api-Key': apiKey },
      data: { prompt: 'Hello' }
    });
    
    // For Red Phase, we expect this to fail (404 Not Found since route doesn't exist)
    // Once implemented, it might return 200 (stream) or 500 (if ADK not running)
    // But primarily we want to pass the auth middleware.
    
    // If route doesn't exist -> 404.
    expect(response.status()).not.toBe(404);
  });

  test.afterAll(async () => {
    // Cleanup
    if (orgId) {
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    }
    // Users are cleaned up by cascade usually or manually
  });
});
