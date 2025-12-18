import { Pool, PoolConfig } from 'pg';

// Check if we're in test mode
const isTestMode = process.env.NODE_ENV === 'test' || process.env.IS_E2E_TEST === 'true';

// Singleton pool for serverless environments
let pool: Pool | null = null;

export function getPool(): Pool {
  // In test mode without DATABASE_URL, create a mock pool that will error on actual queries
  // This prevents crashes during module initialization
  if (isTestMode && !process.env.DATABASE_URL) {
    if (!pool) {
      // Create a minimal mock pool - actual queries should be intercepted before reaching here
      pool = {
        query: async () => {
          throw new Error('Database query attempted in test mode. Add test mode handling to the calling function.');
        },
        connect: async () => {
          throw new Error('Database connect attempted in test mode. Add test mode handling to the calling function.');
        },
        end: async () => {},
        on: () => {},
      } as any;
    }
    return pool!;
  }

  if (!pool) {
    const config: PoolConfig = {
      connectionString: process.env.DATABASE_URL,
      // Serverless-optimized settings
      max: 10, // Maximum connections in pool
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 10000, // Timeout after 10s
    };

    pool = new Pool(config);

    // Handle errors on idle clients
    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
      pool = null; // Reset pool on error
    });
  }

  return pool;
}

// Helper to execute a query with automatic connection management
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query(text, params);
  return result.rows as T[];
}

// Helper for single row queries
export async function queryOne<T = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

// Helper for transactions
export async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Graceful shutdown for serverless
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
