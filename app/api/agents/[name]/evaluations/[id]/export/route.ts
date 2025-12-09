import { NextRequest, NextResponse } from 'next/server';
import {
  EvalSetWithHistory,
  isEvalSet,
} from '@/lib/adk/evaluation-types';
import { readAgentFile } from '@/lib/storage';

async function loadEvalset(agentName: string, evalsetId: string): Promise<EvalSetWithHistory | null> {
  // Try both .test.json and .json extensions
  let content = await readAgentFile(agentName, `evaluations/${evalsetId}.test.json`);
  if (!content) {
    content = await readAgentFile(agentName, `evaluations/${evalsetId}.json`);
  }

  if (!content) {
    return null;
  }

  try {
    const data = JSON.parse(content);
    if (isEvalSet(data)) {
      return data as EvalSetWithHistory;
    }
    return null;
  } catch {
    return null;
  }
}

// GET /api/agents/[name]/evaluations/[id]/export - Export evaluation as .test.json
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  try {
    const { name: agentName, id: evalsetId } = await params;

    const evalset = await loadEvalset(agentName, evalsetId);

    if (!evalset) {
      return NextResponse.json(
        { error: 'Evaluation not found' },
        { status: 404 }
      );
    }

    // Convert evalset to JSON string
    const jsonContent = JSON.stringify(evalset, null, 2);

    // Return as downloadable file
    return new NextResponse(jsonContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${evalset.eval_set_id}.test.json"`,
      },
    });
  } catch (error) {
    console.error('Error exporting evaluation:', error);
    return NextResponse.json(
      {
        error: 'Failed to export evaluation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
