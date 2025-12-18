import { query, queryOne } from './client';
import { User, CreateUserInput, UpdateUserInput } from './types';
import { randomBytes } from 'crypto';

// Generate unique ID
function generateId(): string {
  return randomBytes(16).toString('hex');
}

// Create a new user
export async function createUser(input: CreateUserInput): Promise<User> {
  const id = generateId();
  const now = new Date();

  const result = await queryOne<User>(
    `INSERT INTO "User" (id, email, name, "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [id, input.email, input.name || null, now, now]
  );

  if (!result) throw new Error('Failed to create user');
  return result;
}

// Get user by ID
export async function getUserById(id: string): Promise<User | null> {
  return queryOne<User>('SELECT * FROM "User" WHERE id = $1', [id]);
}

// Get user by email
export async function getUserByEmail(email: string): Promise<User | null> {
  return queryOne<User>('SELECT * FROM "User" WHERE email = $1', [email]);
}

// Find or create user by email (useful for auth)
export async function findOrCreateUser(
  email: string,
  name?: string
): Promise<User> {
  const existing = await getUserByEmail(email);
  if (existing) return existing;

  return createUser({ email, name });
}

// List all users
export async function listUsers(): Promise<User[]> {
  return query<User>('SELECT * FROM "User" ORDER BY "createdAt" DESC');
}

// Update user
export async function updateUser(
  id: string,
  input: UpdateUserInput
): Promise<User | null> {
  const fields: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (input.email !== undefined) {
    fields.push(`email = $${paramIndex++}`);
    params.push(input.email);
  }

  if (input.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    params.push(input.name);
  }

  if (fields.length === 0) {
    return getUserById(id);
  }

  fields.push(`"updatedAt" = $${paramIndex++}`);
  params.push(new Date());

  params.push(id);

  return queryOne<User>(
    `UPDATE "User"
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *`,
    params
  );
}

// Delete user
export async function deleteUser(id: string): Promise<boolean> {
  const result = await query('DELETE FROM "User" WHERE id = $1', [id]);
  return result.length > 0;
}

// Alias for convenience
export { findOrCreateUser as getOrCreateUserByEmail };
