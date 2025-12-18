
import { queryOne, transaction } from './client';

/**
 * Check if a user (by email) is a member of any organization
 */
export async function checkUserOrganizationMembership(email: string): Promise<boolean> {
  // First get the user ID from email
  const user = await queryOne<{ id: string }>(
    'SELECT id FROM "User" WHERE email = $1',
    [email]
  );

  if (!user) {
    return false;
  }

  // Check organization membership
  const membership = await queryOne<{ count: number }>(
    'SELECT count(*) as count FROM organization_members WHERE user_id = $1',
    [user.id]
  );

  return (membership?.count || 0) > 0;
}

/**
 * Get the user's organization
 * Currently assumes single organization per user
 */
export async function getUserOrg(email: string): Promise<{ id: string; name: string } | null> {
  const user = await queryOne<{ id: string }>(
    'SELECT id FROM "User" WHERE email = $1',
    [email]
  );

  if (!user) return null;

  // Get the first organization for the user
  const org = await queryOne<{ id: string; name: string }>(
    `SELECT o.id, o.name 
     FROM organizations o
     JOIN organization_members om ON o.id = om.org_id
     WHERE om.user_id = $1
     LIMIT 1`,
    [user.id]
  );

  return org;
}

/**
 * Get the user's organization or create one if it doesn't exist
 */
export async function ensureUserOrg(email: string): Promise<{ id: string; name: string }> {
  let org = await getUserOrg(email);
  if (org) return org;

  // No org found. Create one.
  return await transaction(async (client) => {
    // Get user id
    const userRes = await client.query('SELECT id, name FROM "User" WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
       throw new Error('User not found');
    }
    const user = userRes.rows[0];
    
    // Create Org
    const name = user.name || email.split('@')[0];
    // Slugify: "Nick Rinard" -> "nick-rinard"
    const slugBase = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const slug = `${slugBase}-${Date.now()}`; // Ensure uniqueness
    const orgName = `${name}'s Organization`;
    
    const orgRes = await client.query(
      'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id, name',
      [orgName, slug]
    );
    const newOrg = orgRes.rows[0];

    // Add Member
    await client.query(
      'INSERT INTO organization_members (org_id, user_id, role) VALUES ($1, $2, $3)',
      [newOrg.id, user.id, 'owner']
    );

    return newOrg;
  });
}
