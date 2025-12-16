import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

// Read .env.local to get DATABASE_URL
const envPath = path.join(process.cwd(), 'nicholasrinard.com-admin-tool', '.env.local');
let dbUrl = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  // Match DATABASE_URL="value" or DATABASE_URL=value
  const match = envContent.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
  if (match) {
    dbUrl = match[1];
  }
} else {
    // Try current dir just in case script is run from inside the folder
    const localEnvPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(localEnvPath)) {
        const envContent = fs.readFileSync(localEnvPath, 'utf8');
        const match = envContent.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
        if (match) {
            dbUrl = match[1];
        }
    }
}

if (!dbUrl) {
  // Fallback to the one we saw in grep if parsing fails, or error out
  console.log('⚠️ Could not parse DATABASE_URL from .env.local, checking env vars...');
  dbUrl = process.env.DATABASE_URL || '';
}

if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL not found in .env.local or environment.');
    process.exit(1);
}

// ADK API Base URL
const ADK_API_URL = 'http://localhost:8000';

async function verifyAdkPostgres() {
  console.log('🔍 Verifying ADK Storage Unification (Red Test)...');
  console.log(`ℹ️  Target DB: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`); // Hide password

  // 1. Check if ADK is running
  try {
    const health = await fetch(`${ADK_API_URL}/list-apps`);
    if (!health.ok) {
        throw new Error('ADK not responding');
    }
  } catch (e) {
      console.error('❌ ADK Service is not running. Please run `make dev-adk` or `./start-adk-services.sh` first.');
      process.exit(1);
  }

  // 2. Create a Session in ADK
  let sessionId = '';
  try {
      // List apps to find a valid agent name
      const appsRes = await fetch(`${ADK_API_URL}/list-apps`);
      const apps = await appsRes.json() as string[];
      
      if (apps.length === 0) {
          console.error('⚠️ No agents found in ADK. Cannot create session.');
          process.exit(1);
      }
      
      const appName = apps[0];
      console.log(`ℹ️  Creating session for agent: ${appName}`);
      
      const createRes = await fetch(`${ADK_API_URL}/apps/${appName}/users/test-user-postgres/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
      });
      
      if (!createRes.ok) {
          const txt = await createRes.text();
          throw new Error(`Failed to create session: ${txt}`);
      }
      
      const sessionData = await createRes.json();
      sessionId = sessionData.id;
      console.log(`✅ Created ADK Session: ${sessionId}`);

      // 2.5 Verify Reading (List Sessions)
      console.log(`ℹ️  Verifying READ operation via API...`);
      const listRes = await fetch(`${ADK_API_URL}/apps/${appName}/users/test-user-postgres/sessions`);
      if (!listRes.ok) {
          throw new Error(`Failed to list sessions: ${await listRes.text()}`);
      }
      const sessions = await listRes.json() as {id: string}[];
      const foundSession = sessions.find(s => s.id === sessionId);
      
      if (!foundSession) {
          console.error('❌ READ VERIFICATION FAILED: Created session not found in list-sessions API response.');
          // We continue to check DB to see if it was written but not readable?
      } else {
          console.log(`✅ READ VERIFIED: Session ${sessionId} found in API response.`);
      }
      
  } catch (e) {
      console.error('❌ Failed to interact with ADK API:', e);
      process.exit(1);
  }

  // 3. Check Postgres for this Session ID
  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    
    // Check if table exists first
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE  table_schema = 'public'
        AND    table_name   = 'session_model' 
      );
    `);
    // Note: ADK's SQLModel usually creates 'session_model' or 'adk_sessions'. 
    // We'll check for 'session_model' which is the default in some versions, or 'adk_session'.
    // Let's list tables to be sure what we are looking for if the check fails.
    
    // Actually, let's just query the likely tables.
    const res = await client.query(`
        SELECT count(*) as cnt FROM information_schema.tables 
        WHERE table_name IN ('session_model', 'adk_session', 'sessions')
    `);
    
    if (parseInt(res.rows[0].cnt) === 0) {
        console.error('❌ GREEN TEST FAILED: ADK tables do not exist in Postgres.');
        process.exit(1); 
    }

    // If table exists, check for the ID
    try {
        // Try 'adk_sessions' as per observed schema
        const sessionCheck = await client.query(`SELECT * FROM adk_sessions WHERE session_id = $1`, [sessionId]);
        if (sessionCheck.rows.length > 0) {
            console.log('✅ GREEN TEST PASSED: Session found in Postgres (adk_sessions)! Storage unification successful.');
            process.exit(0);
        }
        
        // Fallback to 'sessions'
        const sessionCheck2 = await client.query(`SELECT * FROM sessions WHERE id = $1`, [sessionId]);
        if (sessionCheck2.rows.length > 0) {
            console.log('✅ GREEN TEST PASSED: Session found in Postgres (sessions)! Storage unification successful.');
            process.exit(0);
        }

        console.error('❌ GREEN TEST FAILED: Session created but NOT found in Postgres.');
        process.exit(1);

    } catch (e) {
        console.error('❌ DB Query Error:', e);
        // List columns of adk_sessions
        const columns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns
            WHERE table_name = 'adk_sessions'
        `);
        console.log('ℹ️  adk_sessions columns:', columns.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
        process.exit(1);
    }

  } catch (err) {
    console.error('❌ DB Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyAdkPostgres();