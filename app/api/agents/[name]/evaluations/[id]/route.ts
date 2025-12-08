import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
  EvalSet,
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

async function saveEvalset(agentName: string, evalset: EvalSet | EvalSetWithHistory): Promise<void> {
  const evalsDir = path.join(ADK_AGENTS_DIR, agentName, 'evaluations');
  const filepath = path.join(evalsDir, `${evalset.eval_set_id}.test.json`);
  await fs.writeFile(filepath, JSON.stringify(evalset, null, 2));
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

    const filepath = await getEvalsetPath(agentName, evalsetId);

    if (!filepath) {
      return NextResponse.json(
        { error: 'Evaluation not found' },
        { status: 404 }
      );
    }

    await fs.unlink(filepath);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting evalset:', error);
    return NextResponse.json(
      { error: 'Failed to delete evaluation' },
      { status: 500 }
    );
  }
}
