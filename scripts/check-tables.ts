import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

if (fs.existsSync(path.join(__dirname, '../.env.local'))) {
  dotenv.config({ path: path.join(__dirname, '../.env.local') });
} else {
  dotenv.config();
}

import { query } from '../lib/db/client';

async function listTables() {
  try {
    console.log('Connecting to:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@'));
    
    const res = await query(
      "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'tool_registry'"
    );
    console.log('Tool Registry Table:', res);

    const rows = await query('SELECT count(*) FROM public.tool_registry');
    console.log('Rows in tool_registry:', rows);
    
    // Check migrations table
    const migrations = await query('SELECT * FROM migrations');
    console.log('Migrations:', migrations.map((r: any) => r.filename));

  } catch (err) {
    console.error(err);
  }
}

listTables();