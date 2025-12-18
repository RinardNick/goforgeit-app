import { FullConfig } from '@playwright/test';
import { Client } from 'pg';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

async function globalSetup(config: FullConfig) {
  console.log('Global setup: Seeding database for multi-tenant auth tests...');

  // Read .env.local to get DATABASE_URL
  // Check cwd first (if running from app dir)
  let envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    // Fallback to subdir (if running from root)
    envPath = path.join(process.cwd(), 'app.goforgeit.com', '.env.local');
  }
  let dbUrl = '';

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    console.log('DEBUG: envPath:', envPath);
    console.log('DEBUG: envContent length:', envContent.length);
    const match = envContent.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
    if (match) {
      dbUrl = match[1];
      console.log('DEBUG: Found dbUrl (masked):', dbUrl.replace(/:[^:@]+@/, ':****@'));
    } else {
        console.log('DEBUG: Regex failed to match DATABASE_URL');
    }
  }

  if (!dbUrl) {
      console.error('❌ Error: DATABASE_URL not found in .env.local for global setup.');
      process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log('✅ Connected to Postgres for global setup.');

    // Cleanup existing test data if any
    // Note: We delete in reverse order of dependencies
    await client.query(`
      DELETE FROM api_keys
      WHERE user_id IN (SELECT id FROM "User" WHERE email = 'test-multi-tenant-auth@example.com');
    `);

    await client.query(`
      DELETE FROM organization_members 
      WHERE user_id IN (SELECT id FROM "User" WHERE email = 'test-multi-tenant-auth@example.com');
    `);
    
    await client.query(`
      DELETE FROM organization_members 
      WHERE org_id IN (SELECT id FROM organizations WHERE slug = 'test-org');
    `);

    await client.query(`
      DELETE FROM organizations WHERE slug = 'test-org';
    `);
    
    await client.query(`
      DELETE FROM "User" WHERE email = 'test-multi-tenant-auth@example.com';
    `);

    // 1. Create a test user in "User" table
    const userInsert = await client.query(`
      INSERT INTO "User" (name, email)
      VALUES (
        'Test User Multi-Tenant Auth',
        'test-multi-tenant-auth@example.com'
      )
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name
      RETURNING id;
    `);
    const testUserId = userInsert.rows[0].id;
    console.log(`✅ Upserted test user: ${testUserId}`);

    // 2. Create an Organization
    const orgInsert = await client.query(`
      INSERT INTO organizations (name, slug)
      VALUES (
        'Test Organization',
        'test-org'
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name
      RETURNING id;
    `);
    const testOrgId = orgInsert.rows[0].id;
    console.log(`✅ Upserted test organization: ${testOrgId}`);

    // 3. Link user to organization
    await client.query(`
      INSERT INTO organization_members (org_id, user_id, role)
      VALUES (
        '${testOrgId}',
        '${testUserId}',
        'owner'
      )
      ON CONFLICT (org_id, user_id) DO UPDATE SET
        role = EXCLUDED.role;
    `);

    // 4. Create API Key
    const apiKey = 'test-api-key';
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    await client.query(`
      INSERT INTO api_keys (key_hash, key_prefix, user_id, org_id, name)
      VALUES (
        '${keyHash}',
        'test-api',
        '${testUserId}',
        '${testOrgId}',
        'Test Key'
      )
      ON CONFLICT DO NOTHING;
    `);
    console.log('✅ Upserted test API key.');

  } catch (err) {
    console.error('❌ Global setup failed:', err);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Global setup: Database seeding complete.');
  }
}

export default globalSetup;
