
import { test } from 'node:test';
import assert from 'node:assert';
import { checkUserOrganizationMembership } from '../utils';
import { getPool } from '../client';

// Note: These tests run against the DB seeded by global-setup (or we seed here)
// Since unit tests run separately, we should seed/cleanup.

test('checkUserOrganizationMembership', async (t) => {
  const pool = getPool();
  
  // Seed data
  await pool.query(`INSERT INTO "User" (email, name) VALUES ('unit-test-member@example.com', 'Unit Member') ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO organizations (name, slug) VALUES ('Unit Org', 'unit-org') ON CONFLICT DO NOTHING`);
  const user = await pool.query(`SELECT id FROM "User" WHERE email = 'unit-test-member@example.com'`);
  const org = await pool.query(`SELECT id FROM organizations WHERE slug = 'unit-org'`);
  
  await pool.query(`INSERT INTO organization_members (org_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [org.rows[0].id, user.rows[0].id]);

  await t.test('returns true for member', async () => {
    const result = await checkUserOrganizationMembership('unit-test-member@example.com');
    assert.strictEqual(result, true);
  });

  await t.test('returns false for non-member', async () => {
    const result = await checkUserOrganizationMembership('random-person@example.com');
    assert.strictEqual(result, false);
  });
  
  // Cleanup
  await pool.query(`DELETE FROM organization_members WHERE user_id = $1`, [user.rows[0].id]);
  await pool.query(`DELETE FROM organizations WHERE id = $1`, [org.rows[0].id]);
  await pool.query(`DELETE FROM "User" WHERE id = $1`, [user.rows[0].id]);
  
  await pool.end();
});
