/**
 * Simple migration runner for PostgreSQL
 * Runs all .sql files in the migrations/ directory in order
 */

import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

// Explicitly load .env.local if it exists, before other imports
if (fs.existsSync(path.join(__dirname, '../.env.local'))) {
  dotenv.config({ path: path.join(__dirname, '../.env.local') });
} else {
  dotenv.config(); // Fallback to .env
}

import { getPool } from '../lib/db/client';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

async function runMigrations() {
  const pool = getPool();
  const migrationsDir = join(__dirname, '../migrations');

  try {
    // Read all migration files
    const files = await readdir(migrationsDir);
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort(); // Alphabetical order (001_, 002_, etc.)

    console.log(`Found ${sqlFiles.length} migration files`);

    // Create migrations tracking table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check which migrations have already been applied
    const appliedResult = await pool.query('SELECT filename FROM migrations');
    const appliedMigrations = new Set(appliedResult.rows.map(r => r.filename));

    // Run each migration that hasn't been applied
    for (const file of sqlFiles) {
      if (appliedMigrations.has(file)) {
        console.log(`✓ ${file} (already applied)`);
        continue;
      }

      console.log(`Running ${file}...`);
      const sql = await readFile(join(migrationsDir, file), 'utf-8');

      try {
        await pool.query(sql);
        await pool.query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [file]
        );
        console.log(`✓ ${file} (applied successfully)`);
      } catch (error) {
        console.error(`✗ ${file} (failed):`, error);
        throw error;
      }
    }

    console.log('\nAll migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
