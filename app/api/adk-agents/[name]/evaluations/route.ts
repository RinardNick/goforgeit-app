import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
  EvalSet,
  EvalSetWithHistory,
  createEvalSet,
  generateEvalSetId,
  isEvalSet,
} from '@/lib/adk/evaluation-types';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');

// Legacy types for backward compatibility (will be migrated)
interface LegacyTestCase {
  id: string;
  input: string;
  expectedOutput?: string;
  expectedToolCalls?: string[];
  criteria?: string;
}

interface LegacyEvalset {
  id: string;
  name: string;
  description?: string;
  testCases: LegacyTestCase[];
  createdAt: string;
  lastRunAt?: string;
  lastRunPassRate?: number;
  runs?: any[];
}

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

/**
 * Load evalsets - supports both legacy and new ADK format
 */
async function loadEvalsets(agentName: string): Promise<EvalSetWithHistory[]> {
  const evalsDir = await getEvalsDir(agentName);

  try {
    const files = await fs.readdir(evalsDir);
    // Support both .json and .test.json formats
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const evalsets: EvalSetWithHistory[] = [];
    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(path.join(evalsDir, file), 'utf-8');
        const data = JSON.parse(content);

        // Check if it's new ADK format
        if (isEvalSet(data)) {
          evalsets.push(data as EvalSetWithHistory);
        } else {
          // Legacy format - migrate to ADK format
          const legacy = data as LegacyEvalset;
          const migrated = migrateLegacyToADK(agentName, legacy);
          evalsets.push(migrated);
        }
      } catch (error) {
        // Skip invalid files
        console.error(`Failed to parse evalset file: ${file}`, error);
      }
    }

    return evalsets;
  } catch {
    return [];
  }
}

/**
 * Save evalset in ADK .test.json format
 */
async function saveEvalset(agentName: string, evalset: EvalSet | EvalSetWithHistory): Promise<void> {
  const evalsDir = await getEvalsDir(agentName);
  // Use .test.json extension for ADK compatibility
  const filepath = path.join(evalsDir, `${evalset.eval_set_id}.test.json`);
  await fs.writeFile(filepath, JSON.stringify(evalset, null, 2));
}

/**
 * Migrate legacy evalset format to ADK format
 */
function migrateLegacyToADK(agentName: string, legacy: LegacyEvalset): EvalSetWithHistory {
  const evalSet = createEvalSet(legacy.name, legacy.description);

  // Keep the legacy ID for file compatibility
  evalSet.eval_set_id = legacy.id;

  // Convert legacy test cases to ADK eval cases
  // For now, treat each test case as a single-turn conversation
  evalSet.eval_cases = legacy.testCases.map((tc) => ({
    eval_id: tc.id,
    conversation: [
      {
        invocation_id: crypto.randomUUID(),
        user_content: {
          parts: [{ text: tc.input }],
          role: 'user' as const,
        },
        final_response: tc.expectedOutput
          ? {
              parts: [{ text: tc.expectedOutput }],
              role: 'model' as const,
            }
          : undefined,
        intermediate_data: tc.expectedToolCalls
          ? {
              tool_uses: tc.expectedToolCalls.map((toolName) => ({
                id: `adk-${crypto.randomUUID()}`,
                name: toolName,
                args: {},
              })),
            }
          : undefined,
      },
    ],
    session_input: {
      app_name: agentName,
      user_id: `eval-user-${Date.now()}`,
    },
  }));

  return {
    ...evalSet,
    runs: legacy.runs,
    baseline_run_id: undefined,
  };
}

// GET /api/adk-agents/[name]/evaluations - List all evalsets
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: agentName } = await params;

    // Verify agent exists
    const agentDir = path.join(ADK_AGENTS_DIR, agentName);
    try {
      await fs.access(agentDir);
    } catch {
      return NextResponse.json(
        { error: `Agent '${agentName}' not found` },
        { status: 404 }
      );
    }

    const evalsets = await loadEvalsets(agentName);

    return NextResponse.json({ evalsets });
  } catch (error) {
    console.error('Error listing evalsets:', error);
    return NextResponse.json(
      { error: 'Failed to list evaluations' },
      { status: 500 }
    );
  }
}

// POST /api/adk-agents/[name]/evaluations - Create new evalset
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: agentName } = await params;
    const body = await request.json();

    const { name, description, eval_cases = [] } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Verify agent exists
    const agentDir = path.join(ADK_AGENTS_DIR, agentName);
    try {
      await fs.access(agentDir);
    } catch {
      return NextResponse.json(
        { error: `Agent '${agentName}' not found` },
        { status: 404 }
      );
    }

    // Create ADK-compliant evalset
    // Ensure all eval_cases have session_input with app_name
    const processedCases = eval_cases.map((evalCase: any) => {
      // If session_input is missing or doesn't have app_name, add it
      if (!evalCase.session_input || !evalCase.session_input.app_name) {
        return {
          ...evalCase,
          session_input: {
            app_name: agentName,
            user_id: evalCase.session_input?.user_id || `eval-user-${Date.now()}`,
            state: evalCase.session_input?.state || {},
          },
        };
      }
      return evalCase;
    });

    const evalset: EvalSetWithHistory = {
      ...createEvalSet(name.trim(), description?.trim()),
      eval_cases: processedCases,
      runs: [],
    };

    await saveEvalset(agentName, evalset);

    return NextResponse.json(evalset, { status: 201 });
  } catch (error) {
    console.error('Error creating evalset:', error);
    return NextResponse.json(
      { error: 'Failed to create evaluation' },
      { status: 500 }
    );
  }
}
