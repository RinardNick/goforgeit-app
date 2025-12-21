
import { query } from '../lib/db/client';

async function main() {
  try {
    console.log('Verifying Migration 028: API Key Scoping...');
    
    // Check for 'scoped_agents' column in 'api_keys' table
    const scopedAgentsColumn = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'api_keys' AND column_name = 'scoped_agents';
    `);

    if (scopedAgentsColumn.length > 0) {
      console.log('✅ api_keys.scoped_agents column exists');
    } else {
      console.error('❌ api_keys.scoped_agents column MISSING');
      process.exit(1);
    }

    // Check for 'org_id' column in 'api_keys' table
    const orgIdColumn = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'api_keys' AND column_name = 'org_id';
    `);

    if (orgIdColumn.length > 0) {
      console.log('✅ api_keys.org_id column exists');
    } else {
      console.error('❌ api_keys.org_id column MISSING');
      process.exit(1);
    }

    console.log('Migration 028 verification PASSED');
  } catch (error) {
    console.error('Error verifying migration:', error);
    process.exit(1);
  }
}

main();
