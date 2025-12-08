/**
 * Google ADK Evaluation System TypeScript Interfaces
 *
 * Complete type definitions for Google ADK evaluation data structures.
 * Reference: https://google.github.io/adk-docs/evaluate/
 */

/**
 * Content part (text component of messages)
 */
export interface ContentPart {
  text: string;
}

/**
 * User or model content with role
 */
export interface Content {
  parts: ContentPart[];
  role: 'user' | 'model';
}

/**
 * Tool use specification (expected tool call)
 */
export interface ToolUse {
  id: string; // Format: "adk-{uuid}"
  name: string; // Tool name (e.g., "google_search")
  args: Record<string, any>; // Tool arguments
}

/**
 * Intermediate response from sub-agent
 * Format: [agent_name, [response_parts]]
 */
export type IntermediateResponse = [string, ContentPart[]];

/**
 * Intermediate data for a turn (tool uses and sub-agent responses)
 */
export interface IntermediateData {
  tool_uses?: ToolUse[];
  intermediate_responses?: IntermediateResponse[];
}

/**
 * Single turn in a multi-turn conversation
 */
export interface ConversationTurn {
  invocation_id: string; // UUID for this turn
  user_content: Content; // User message
  final_response?: Content; // Expected agent response
  intermediate_data?: IntermediateData; // Tool uses and intermediate responses
}

/**
 * Session input configuration for an eval case
 */
export interface SessionInput {
  app_name: string; // Agent/app name
  user_id: string; // User identifier
  state?: Record<string, any>; // Initial session state
}

/**
 * Single evaluation case (one conversation session)
 */
export interface EvalCase {
  eval_id: string; // Unique identifier for this case
  conversation: ConversationTurn[]; // Multi-turn conversation
  session_input: SessionInput; // Session configuration
}

/**
 * Complete evaluation set (.test.json format)
 */
export interface EvalSet {
  eval_set_id: string; // Unique identifier
  name: string; // Display name
  description?: string; // Purpose documentation
  eval_cases: EvalCase[]; // Array of evaluation cases
}

/**
 * Evaluation metric types
 */
export type EvaluationMetric =
  | 'tool_trajectory_avg_score' // Deterministic: exact tool call sequence match
  | 'response_match_score' // Deterministic: ROUGE-1 similarity
  | 'final_response_match_v2' // LLM-based: semantic equivalence
  | 'rubric_based_final_response_quality_v1' // LLM-based: quality assessment
  | 'rubric_based_tool_use_quality_v1' // LLM-based: tool usage validation
  | 'hallucinations_v1' // LLM-based: groundedness check
  | 'safety_v1'; // LLM-based: harmfulness assessment

/**
 * Metric threshold configuration
 */
export interface MetricThreshold {
  metric: EvaluationMetric;
  threshold: number; // 0-1 for scores, binary for pass/fail
  enabled: boolean;
}

/**
 * Test configuration (test_config.json)
 */
export interface TestConfig {
  metrics: MetricThreshold[];
  parallel?: boolean; // Run cases in parallel
  workers?: number; // Number of parallel workers
}

/**
 * Result for a single metric evaluation
 */
export interface MetricResult {
  metric: EvaluationMetric;
  score: number; // 0-100 or 0-1 depending on metric
  passed: boolean;
  reasoning?: string; // LLM reasoning for LLM-based metrics
  details?: {
    // For ROUGE scores
    precision?: number;
    recall?: number;
    f1?: number;
    // For hallucination detection
    hallucinations?: string[];
    // For safety violations
    violations?: string[];
  };
}

/**
 * Result for a single conversation turn
 */
export interface TurnResult {
  invocation_id: string;
  actual_response: Content;
  actual_tool_calls: ToolUse[];
  metrics: MetricResult[];
  passed: boolean; // Overall pass for this turn
}

/**
 * Result for a single eval case
 */
export interface EvalCaseResult {
  eval_id: string;
  turns: TurnResult[];
  overall_score: number; // Average across all metrics
  passed: boolean;
}

/**
 * Complete evaluation run result
 */
export interface EvalRun {
  run_id: string;
  eval_set_id: string;
  timestamp: string; // ISO 8601
  results: EvalCaseResult[];
  overall_pass_rate: number; // Percentage of cases that passed
  metrics_summary: {
    [K in EvaluationMetric]?: {
      avg_score: number;
      pass_rate: number;
    };
  };
  tags?: string[]; // e.g., ["baseline", "experiment-1"]
  notes?: string; // User notes about this run
}

/**
 * Evaluation history (stored with evalset)
 */
export interface EvalSetWithHistory extends EvalSet {
  runs?: EvalRun[]; // Last N runs (default 10)
  baseline_run_id?: string; // Marked baseline for comparison
}

/**
 * Prompt experiment tracking
 */
export interface PromptExperiment {
  experiment_id: string;
  eval_set_id: string;
  name: string;
  description?: string;
  prompt_changes: {
    file: string; // Which agent YAML file
    diff: string; // Git-style diff
  }[];
  run_id?: string; // Associated eval run
  created_at: string;
}

// ============================================================================
// Helper type guards
// ============================================================================

export function isEvalSet(obj: any): obj is EvalSet {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.eval_set_id === 'string' &&
    typeof obj.name === 'string' &&
    Array.isArray(obj.eval_cases)
  );
}

export function isEvalCase(obj: any): obj is EvalCase {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.eval_id === 'string' &&
    Array.isArray(obj.conversation) &&
    obj.session_input &&
    typeof obj.session_input.app_name === 'string'
  );
}

export function isConversationTurn(obj: any): obj is ConversationTurn {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.invocation_id === 'string' &&
    obj.user_content &&
    obj.user_content.role === 'user'
  );
}

// ============================================================================
// Helper functions for creating ADK-compliant structures
// ============================================================================

/**
 * Generate ADK-format tool use ID
 */
export function generateToolUseId(): string {
  return `adk-${crypto.randomUUID()}`;
}

/**
 * Generate eval case ID
 */
export function generateEvalCaseId(): string {
  return `eval-case-${crypto.randomUUID()}`;
}

/**
 * Generate eval set ID from name
 */
export function generateEvalSetId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Create content object from text
 */
export function createContent(text: string, role: 'user' | 'model'): Content {
  return {
    parts: [{ text }],
    role,
  };
}

/**
 * Create tool use object
 */
export function createToolUse(name: string, args: Record<string, any>): ToolUse {
  return {
    id: generateToolUseId(),
    name,
    args,
  };
}

/**
 * Create conversation turn
 */
export function createConversationTurn(
  userMessage: string,
  expectedResponse?: string,
  toolUses?: ToolUse[],
  intermediateResponses?: IntermediateResponse[]
): ConversationTurn {
  const turn: ConversationTurn = {
    invocation_id: crypto.randomUUID(),
    user_content: createContent(userMessage, 'user'),
  };

  if (expectedResponse) {
    turn.final_response = createContent(expectedResponse, 'model');
  }

  if (toolUses || intermediateResponses) {
    turn.intermediate_data = {};
    if (toolUses) turn.intermediate_data.tool_uses = toolUses;
    if (intermediateResponses) turn.intermediate_data.intermediate_responses = intermediateResponses;
  }

  return turn;
}

/**
 * Create eval case
 */
export function createEvalCase(
  appName: string,
  conversation: ConversationTurn[],
  userId?: string,
  initialState?: Record<string, any>
): EvalCase {
  return {
    eval_id: generateEvalCaseId(),
    conversation,
    session_input: {
      app_name: appName,
      user_id: userId || `eval-user-${Date.now()}`,
      state: initialState,
    },
  };
}

/**
 * Create eval set
 */
export function createEvalSet(
  name: string,
  description?: string,
  evalCases?: EvalCase[]
): EvalSet {
  return {
    eval_set_id: generateEvalSetId(name),
    name,
    description,
    eval_cases: evalCases || [],
  };
}
