import { NextRequest, NextResponse } from 'next/server';
import {
  EvalSetWithHistory,
  createEvalSet,
  isEvalSet,
} from '@/lib/adk/evaluation-types';
import {
  readAgentFile,
  writeAgentFile,
  listAgentFiles,
  verifyAgentExists,
  ensureEvalsDir,
} from '@/lib/storage';

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

/**
 * Load evalsets - supports both legacy and new ADK format
 */
async function loadEvalsets(agentName: string): Promise<EvalSetWithHistory[]> {
  const files = await listAgentFiles(agentName, 'evaluations');
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  const evalsets: EvalSetWithHistory[] = [];
  for (const file of jsonFiles) {
    try {
      const content = await readAgentFile(agentName, `evaluations/${file}`);
      if (!content) continue;

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
}

/**
 * Save evalset in ADK .test.json format
 */
async function saveEvalset(agentName: string, evalset: EvalSetWithHistory): Promise<void> {
  await ensureEvalsDir(agentName);
  await writeAgentFile(
    agentName,
    `evaluations/${evalset.eval_set_id}.test.json`,
    JSON.stringify(evalset, null, 2),
    'application/json'
  );
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

// GET /api/agents/[name]/evaluations - List all evalsets
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: agentName } = await params;

    // Verify agent exists
    if (!(await verifyAgentExists(agentName))) {
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

// POST /api/agents/[name]/evaluations - Create new evalset
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
    if (!(await verifyAgentExists(agentName))) {
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
