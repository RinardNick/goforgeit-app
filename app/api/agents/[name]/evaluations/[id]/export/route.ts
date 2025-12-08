import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
  EvalSetWithHistory,
  isEvalSet,
} from '@/lib/adk/evaluation-types';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');

async function getEvalsetPath(agentName: string, evalsetId: string): Promise<string | null> {
  const evalsDir = path.join(ADK_AGENTS_DIR, agentName, 'evaluations');

  // Try both .test.json and .json extensions
  const testJsonPath = path.join(evalsDir, `${evalsetId}.test.json`);
  const jsonPath = path.join(evalsDir, `${evalsetId}.json`);

  try {
    await fs.access(testJsonPath);
    return testJsonPath;
  } catch {
    try {
      await fs.access(jsonPath);
      return jsonPath;
    } catch {
      return null;
    }
  }
}

async function loadEvalset(agentName: string, evalsetId: string): Promise<EvalSetWithHistory | null> {
  const filepath = await getEvalsetPath(agentName, evalsetId);

  if (!filepath) {
    return null;
  }

  try {
    const content = await fs.readFile(filepath, 'utf-8');
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
