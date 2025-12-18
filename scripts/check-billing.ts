import { query } from '../lib/db/client';

async function main() {
  try {
    console.log('Checking billing_ledger...');
    const rows = await query('SELECT * FROM billing_ledger ORDER BY created_at DESC LIMIT 5');
    console.log('Recent billing rows:', JSON.stringify(rows, null, 2));
    
    if (rows.length === 0) {
      console.log('⚠️ No billing records found.');
    }
  } catch (error) {
    console.error('Error querying database:', error);
  }
}

main();
