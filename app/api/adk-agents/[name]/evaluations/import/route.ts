import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
  EvalSetWithHistory,
  isEvalSet,
} from '@/lib/adk/evaluation-types';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');

async function getEvalsDir(agentName: string): Promise<string> {
  const evalsDir = path.join(ADK_AGENTS_DIR, agentName, 'evaluations');

  // Ensure directory exists
  try {
    await fs.access(evalsDir);
  } catch {
    await fs.mkdir(evalsDir, { recursive: true });
  }

  return evalsDir;
}

async function saveEvalset(agentName: string, evalset: EvalSetWithHistory): Promise<void> {
  const evalsDir = await getEvalsDir(agentName);
  // Use .test.json extension for ADK compatibility
  const filepath = path.join(evalsDir, `${evalset.eval_set_id}.test.json`);
  await fs.writeFile(filepath, JSON.stringify(evalset, null, 2));
}

// POST /api/adk-agents/[name]/evaluations/import - Import .test.json file
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: agentName } = await params;
    const body = await request.json();
    const { fileContent } = body;

    if (!fileContent) {
      return NextResponse.json(
        { error: 'File content is required' },
        { status: 400 }
      );
    }

    // Parse the .test.json content
    let parsedEvalset: any;
    try {
      parsedEvalset = JSON.parse(fileContent);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON format' },
        { status: 400 }
      );
    }

    // Validate it's an ADK EvalSet
    if (!isEvalSet(parsedEvalset)) {
      return NextResponse.json(
        { error: 'Invalid .test.json format. Missing required fields (eval_set_id, name, eval_cases)' },
        { status: 400 }
      );
    }

    const evalset = parsedEvalset as EvalSetWithHistory;

    // Check if evalset with same ID already exists
    const evalsDir = await getEvalsDir(agentName);
    const existingFile = path.join(evalsDir, `${evalset.eval_set_id}.test.json`);

    try {
      await fs.access(existingFile);
      return NextResponse.json(
        { error: `Evaluation with ID "${evalset.eval_set_id}" already exists. Please rename or delete the existing one.` },
        { status: 409 }
      );
    } catch {
      // File doesn't exist, proceed with import
    }

    // Save the evalset
    await saveEvalset(agentName, evalset);

    return NextResponse.json({
      evalset,
      message: 'Imported successfully',
    });
  } catch (error) {
    console.error('Error importing evaluation:', error);
    return NextResponse.json(
      {
        error: 'Failed to import evaluation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
