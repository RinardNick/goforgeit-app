
import { test } from 'node:test';
import assert from 'node:assert';
import { createApiKey, listApiKeys, revokeApiKey } from '../api-keys';
import { getPool } from '../client';

test('API Keys CRUD', async (t) => {
  const pool = getPool();
  
  // Setup: Create User and Org
  const email = 'apikey-test@example.com';
  await pool.query(`INSERT INTO "User" (email, name) VALUES ($1, 'API Key Tester') ON CONFLICT (email) DO NOTHING`, [email]);
  const userRes = await pool.query(`SELECT id FROM "User" WHERE email = $1`, [email]);
  const userId = userRes.rows[0].id;

  const orgSlug = 'apikey-test-org';
  await pool.query(`INSERT INTO organizations (name, slug) VALUES ('API Key Test Org', $1) ON CONFLICT (slug) DO NOTHING`, [orgSlug]);
  const orgRes = await pool.query(`SELECT id FROM organizations WHERE slug = $1`, [orgSlug]);
  const orgId = orgRes.rows[0].id;
  
  // Create dummy agent
  await pool.query(`INSERT INTO agents (org_id, name, description) VALUES ($1, 'apikey-test-agent', 'Test Agent') ON CONFLICT DO NOTHING`, [orgId]);
  const agentRes = await pool.query(`SELECT id FROM agents WHERE org_id = $1 AND name = 'apikey-test-agent'`, [orgId]);
  const agentId = agentRes.rows[0].id;

  let createdKeyId: string;

  await t.test('createApiKey creates a new key with scopes', async () => {
    const result = await createApiKey({
      name: 'Test Key',
      userId,
      orgId,
      scopedAgents: [agentId]
    });

    assert.ok(result.apiKey.startsWith('sk_live_'));
    assert.ok(result.id);
    assert.strictEqual(result.name, 'Test Key');
    assert.deepStrictEqual(result.scopedAgents, [agentId]);
    
    createdKeyId = result.id;
  });

  await t.test('listApiKeys returns keys for org', async () => {
    const keys = await listApiKeys(orgId);
    const myKey = keys.find(k => k.id === createdKeyId);
    
    assert.ok(myKey);
    assert.strictEqual(myKey.name, 'Test Key');
    assert.deepStrictEqual(myKey.scoped_agents, [agentId]);
    // Should NOT return the full key
    assert.strictEqual((myKey as any).key_hash, undefined); 
  });

  await t.test('revokeApiKey revokes the key', async () => {
    await revokeApiKey(createdKeyId, userId);
    
    const keys = await listApiKeys(orgId);
    const myKey = keys.find(k => k.id === createdKeyId);
    assert.ok(myKey, 'Key should be found');
    assert.ok(myKey.revoked_at, 'Key should be revoked');
  });

  // Cleanup
  await pool.query(`DELETE FROM api_keys WHERE org_id = $1`, [orgId]);
  await pool.query(`DELETE FROM agents WHERE id = $1`, [agentId]);
  await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
  await pool.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
});
