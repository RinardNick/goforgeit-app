import { query, queryOne } from './client';
import type { ContactSubmission, ListContactsOptions } from './types';
import { ContactSubmissionStatus } from './types';

// Re-export types for backward compatibility
export type { ContactSubmission, ListContactsOptions } from './types';
export { ContactSubmissionStatus } from './types';

export async function listContactSubmissions(
  options: ListContactsOptions = {}
): Promise<ContactSubmission[]> {
  const { status, searchQuery, limit = 50, offset = 0 } = options;

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (status) {
    whereClause += ` AND status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (searchQuery) {
    whereClause += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
    params.push(`%${searchQuery}%`);
    paramIndex++;
  }

  params.push(limit);
  const limitParam = paramIndex++;
  params.push(offset);
  const offsetParam = paramIndex;

  const submissions = await query<ContactSubmission>(
    `SELECT id, name, email, subject, message, status, "sessionId", "createdAt", "readAt"
     FROM "ContactSubmission"
     ${whereClause}
     ORDER BY "createdAt" DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    params
  );

  return submissions;
}

export async function getContactSubmission(id: string): Promise<ContactSubmission | null> {
  return await queryOne<ContactSubmission>(
    `SELECT id, name, email, subject, message, status, "sessionId", "createdAt", "readAt"
     FROM "ContactSubmission"
     WHERE id = $1`,
    [id]
  );
}

export async function updateContactSubmissionStatus(
  id: string,
  status: ContactSubmissionStatus
): Promise<ContactSubmission | null> {
  const readAt = status === ContactSubmissionStatus.READ ? new Date() : null;

  return await queryOne<ContactSubmission>(
    `UPDATE "ContactSubmission"
     SET status = $1, "readAt" = $2
     WHERE id = $3
     RETURNING id, name, email, subject, message, status, "sessionId", "createdAt", "readAt"`,
    [status, readAt, id]
  );
}
