import { query } from '../lib/db/client';

async function main() {
  try {
    console.log('Checking tables in database...');
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('Tables found:', tables.map(t => t.table_name));
    
    const agentsTable = tables.find(t => t.table_name === 'agents');
    if (agentsTable) {
      console.log('✅ agents table exists');
    } else {
      console.error('❌ agents table MISSING');
    }
  } catch (error) {
    console.error('Error querying database:', error);
  }
}

main();
