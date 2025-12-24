import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  EvalSetWithHistory,
  EvalRun,
  EvalCaseResult,
  TurnResult,
  isEvalSet,
  MetricResult,
} from '@/lib/adk/evaluation-types';
import {
  readAgentFile,
  writeAgentFile,
  ensureEvalsDir,
  USE_GCS,
} from '@/lib/storage';

const execAsync = promisify(exec);
const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');
const ADK_BACKEND_URL = process.env.ADK_BACKEND_URL || 'http://127.0.0.1:8000';

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
 * Run ADK eval CLI command and return the result file path (local only)
 */
async function runAdkEvalLocal(
  agentName: string,
  evalsetId: string
): Promise<string> {
  const agentsDir = ADK_AGENTS_DIR;
  const evalsetPath = path.join(agentsDir, agentName, 'evaluations', `${evalsetId}.test.json`);
  const relativeEvalsetPath = path.relative(agentsDir, evalsetPath);

  // Run adk eval command from agents directory
  const command = `cd "${agentsDir}" && adk eval ${agentName} ${relativeEvalsetPath} 2>&1`;

  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 300000, // 5 minute timeout
    });

    // Parse output to find the result file path
    // ADK prints: "Writing eval result to file: /path/to/result.json"
    const outputLines = (stdout + stderr).split('\n');
    for (const line of outputLines) {
      if (line.includes('Writing eval result to file:')) {
        const match = line.match(/Writing eval result to file: (.+\.evalset_result\.json)/);
        if (match) {
          return match[1];
        }
      }
    }

    throw new Error('Could not find eval result file path in ADK output');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`ADK eval failed: ${error.message}`);
    }
    throw new Error('ADK eval failed with unknown error');
  }
}

/**
 * Run ADK eval via backend API (production)
 */
async function runAdkEvalViaBackend(
  agentName: string,
  evalset: EvalSetWithHistory
): Promise<EvalCaseResult[]> {
  // In production, we need to call the ADK backend's eval endpoint
  // For now, return a placeholder since the ADK backend doesn't have an eval API yet
  // This will need to be implemented when the backend supports it
  throw new Error('Evaluation execution is not yet supported in production. Please run evaluations locally.');
}

/**
 * Parse ADK eval result file and transform to our format
 */
async function parseAdkEvalResult(resultFilePath: string): Promise<EvalCaseResult[]> {
  try {
    const content = await fs.readFile(resultFilePath, 'utf-8');
    let adkResult = JSON.parse(content);

    // Handle double-encoded JSON (ADK sometimes writes quoted JSON strings)
    if (typeof adkResult === 'string') {
      adkResult = JSON.parse(adkResult);
    }

    const results: EvalCaseResult[] = [];

    // Transform ADK's eval_case_results to our format
    for (const caseResult of adkResult.eval_case_results || []) {
      const turns: TurnResult[] = [];

      // Process each invocation/turn
      for (const invocationResult of caseResult.eval_metric_result_per_invocation || []) {
        const { actual_invocation, expected_invocation, eval_metric_results } = invocationResult;

        // Transform ADK metrics to our MetricResult format
        const metrics: MetricResult[] = (eval_metric_results || []).map((m: any) => ({
          metric: m.metric_name,
          score: m.score,
          passed: m.eval_status === 1, // 1 = PASSED, 2 = FAILED
          threshold: m.threshold,
          details: m.details,
        }));

        const turnPassed = metrics.every(m => m.passed);

        turns.push({
          invocation_id: actual_invocation?.invocation_id || expected_invocation?.invocation_id || 'unknown',
          actual_response: actual_invocation?.final_response || {
            parts: [{ text: '' }],
            role: 'model',
          },
          actual_tool_calls: actual_invocation?.intermediate_data?.tool_uses || [],
          metrics,
          passed: turnPassed,
        });
      }

      const passedTurns = turns.filter(t => t.passed).length;
      const overall_score = turns.length > 0 ? (passedTurns / turns.length) * 100 : 0;

      results.push({
        eval_id: caseResult.eval_id,
        turns,
        overall_score,
        passed: caseResult.final_eval_status === 1, // 1 = PASSED
      });
    }

    return results;
  } catch (error) {
    throw new Error(`Failed to parse ADK eval result: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// POST /api/agents/[name]/evaluations/[id]/run - Execute evaluation
export async function POST(
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

    if (evalset.eval_cases.length === 0) {
      return NextResponse.json(
        { error: 'Cannot run evaluation with no conversations' },
        { status: 400 }
      );
    }

    let results: EvalCaseResult[];

    if (USE_GCS) {
      // Production: Use ADK backend (not yet implemented)
      return NextResponse.json(
        { error: 'Evaluation execution is not yet supported in production. Please run evaluations locally.' },
        { status: 501 }
      );
    } else {
      // Local: Run ADK eval CLI command
      const resultFilePath = await runAdkEvalLocal(agentName, evalsetId);
      results = await parseAdkEvalResult(resultFilePath);
    }

    // Calculate overall pass rate
    const passedCases = results.filter(r => r.passed).length;
    const overall_pass_rate = Math.round((passedCases / results.length) * 100);

    // Calculate metrics summary (aggregate across all turns)
    const allMetricNames = new Set<string>();
    for (const result of results) {
      for (const turn of result.turns) {
        for (const metric of turn.metrics) {
          allMetricNames.add(metric.metric);
        }
      }
    }

    const metrics_summary: Record<string, { avg_score: number; pass_rate: number }> = {};

    for (const metricName of Array.from(allMetricNames)) {
      const allMetricResults: MetricResult[] = [];

      // Collect all results for this metric across all turns
      for (const result of results) {
        for (const turn of result.turns) {
          const metricResult = turn.metrics.find(m => m.metric === metricName);
          if (metricResult) {
            allMetricResults.push(metricResult);
          }
        }
      }

      if (allMetricResults.length > 0) {
        const totalScore = allMetricResults.reduce((sum, m) => sum + m.score, 0);
        const passedCount = allMetricResults.filter(m => m.passed).length;

        metrics_summary[metricName] = {
          avg_score: totalScore / allMetricResults.length,
          pass_rate: (passedCount / allMetricResults.length) * 100,
        };
      }
    }

    // Create run record
    const run: EvalRun = {
      run_id: crypto.randomUUID(),
      eval_set_id: evalset.eval_set_id,
      timestamp: new Date().toISOString(),
      results,
      overall_pass_rate,
      metrics_summary,
    };

    // Update evalset with run history
    if (!evalset.runs) {
      evalset.runs = [];
    }
    evalset.runs.push(run);

    // Keep only last 10 runs
    if (evalset.runs.length > 10) {
      evalset.runs = evalset.runs.slice(-10);
    }

    await saveEvalset(agentName, evalset);

    return NextResponse.json({
      evalset,
      run,
    });
  } catch (error) {
    console.error('Error running evaluation:', error);
    return NextResponse.json(
      {
        error: 'Failed to run evaluation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
