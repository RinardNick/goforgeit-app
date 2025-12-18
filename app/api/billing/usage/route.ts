import { NextResponse } from 'next/server';
import { query } from '@/lib/db/client';
import { auth } from '@/auth';
import { ensureUserOrg } from '@/lib/db/utils';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await ensureUserOrg(session.user.email);

    // Group by project, agent and model
    const usageByAgent = await query(`
      SELECT 
        COALESCE(p.name, 'Unorganized') as project_name,
        COALESCE(metadata->>'agent', 'Unknown Agent') as agent_name,
        COALESCE(metadata->>'model', 'unknown') as model,
        COUNT(*) as request_count,
        SUM(amount) as total_cost,
        SUM(CAST(metadata->>'tokens' AS NUMERIC)) as total_tokens,
        SUM(CAST(metadata->>'promptTokens' AS NUMERIC)) as prompt_tokens,
        SUM(CAST(metadata->>'completionTokens' AS NUMERIC)) as completion_tokens
      FROM billing_ledger bl
      LEFT JOIN agents a ON bl.metadata->>'agent' = a.name AND bl.org_id = a.org_id
      LEFT JOIN projects p ON a.project_id = p.id
      WHERE bl.transaction_type = 'usage' AND bl.org_id = $1
      GROUP BY 1, 2, 3
      ORDER BY project_name, agent_name, total_cost DESC
    `, [org.id]);

    // Get daily cost breakdown by project (last 30 days)
    const dailyUsage = await query(`
      SELECT 
        TO_CHAR(bl.created_at, 'YYYY-MM-DD') as date,
        COALESCE(p.name, 'Unorganized') as project_name,
        SUM(bl.amount) as cost
      FROM billing_ledger bl
      LEFT JOIN agents a ON bl.metadata->>'agent' = a.name AND bl.org_id = a.org_id
      LEFT JOIN projects p ON a.project_id = p.id
      WHERE bl.created_at > NOW() - INTERVAL '30 days' AND bl.org_id = $1
      GROUP BY 1, 2
      ORDER BY 1, 2
    `, [org.id]);

    // Group by project
    const usageByProject = await query(`
      SELECT 
        COALESCE(p.name, 'Unorganized') as project_name,
        COUNT(*) as request_count,
        SUM(bl.amount) as total_cost
      FROM billing_ledger bl
      LEFT JOIN agents a ON bl.metadata->>'agent' = a.name AND bl.org_id = a.org_id
      LEFT JOIN projects p ON a.project_id = p.id
      WHERE bl.transaction_type = 'usage' AND bl.org_id = $1
      GROUP BY 1
      ORDER BY total_cost DESC
    `, [org.id]);

    return NextResponse.json({
      usageByAgent,
      usageByProject,
      dailyUsage
    });
  } catch (error) {
    console.error('[Billing API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch billing data' }, { status: 500 });
  }
}
