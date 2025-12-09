import { NextRequest, NextResponse } from 'next/server';
import {
  EvalSet,
  EvalSetWithHistory,
  isEvalSet,
} from '@/lib/adk/evaluation-types';
import {
  readAgentFile,
  writeAgentFile,
  deleteAgentFile,
  ensureEvalsDir,
} from '@/lib/storage';

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

async function saveEvalset(agentName: string, evalset: EvalSet | EvalSetWithHistory): Promise<void> {
  await ensureEvalsDir(agentName);
  await writeAgentFile(
    agentName,
    `evaluations/${evalset.eval_set_id}.test.json`,
    JSON.stringify(evalset, null, 2),
    'application/json'
  );
}

async function deleteEvalsetFile(agentName: string, evalsetId: string): Promise<boolean> {
  // Try both .test.json and .json extensions
  let deleted = await deleteAgentFile(agentName, `evaluations/${evalsetId}.test.json`);
  if (!deleted) {
    deleted = await deleteAgentFile(agentName, `evaluations/${evalsetId}.json`);
  }
  return deleted;
}

// GET /api/agents/[name]/evaluations/[id] - Get evalset detail
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

    return NextResponse.json({ evalset });
  } catch (error) {
    console.error('Error fetching evalset:', error);
    return NextResponse.json(
      { error: 'Failed to fetch evaluation' },
      { status: 500 }
    );
  }
}

// PATCH /api/agents/[name]/evaluations/[id] - Update evalset
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  try {
    const { name: agentName, id: evalsetId } = await params;
    const body = await request.json();

    const evalset = await loadEvalset(agentName, evalsetId);

    if (!evalset) {
      return NextResponse.json(
        { error: 'Evaluation not found' },
        { status: 404 }
      );
    }

    // Update allowed fields
    if (body.name !== undefined) evalset.name = body.name;
    if (body.description !== undefined) evalset.description = body.description;
    if (body.eval_cases !== undefined) evalset.eval_cases = body.eval_cases;
    if (body.runs !== undefined) evalset.runs = body.runs;
    if (body.baseline_run_id !== undefined) evalset.baseline_run_id = body.baseline_run_id;

    await saveEvalset(agentName, evalset);

    return NextResponse.json({ evalset });
  } catch (error) {
    console.error('Error updating evalset:', error);
    return NextResponse.json(
      { error: 'Failed to update evaluation' },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[name]/evaluations/[id] - Delete evalset
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  try {
    const { name: agentName, id: evalsetId } = await params;

    const deleted = await deleteEvalsetFile(agentName, evalsetId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Evaluation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting evalset:', error);
    return NextResponse.json(
      { error: 'Failed to delete evaluation' },
      { status: 500 }
    );
  }
}
