/**
 * ADK Test Helpers
 *
 * Shared utilities for E2E tests that need to create/delete test agents
 * and evaluation sets via the API.
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

/**
 * Create a test agent via API
 */
export async function createTestAgent(
  agentName: string,
  description: string = 'Test agent'
): Promise<void> {
  const rootAgentYaml = `name: ${agentName}
agent_class: LlmAgent
model: gemini-2.0-flash-exp
description: ${description}
instruction: You are a helpful test agent.
tools: []
`;

  // First, ensure the agent project exists by creating the root agent file
  const response = await fetch(`${BASE_URL}/api/agents/${agentName}/files`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: 'root_agent.yaml', yaml: rootAgentYaml }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create test agent: ${response.statusText}`);
  }
}

/**
 * Delete a test agent via API
 */
export async function deleteTestAgent(agentName: string): Promise<void> {
  try {
    const response = await fetch(`${BASE_URL}/api/agents/${agentName}`, {
      method: 'DELETE',
    });
    // Ignore errors - agent might not exist
    if (!response.ok && response.status !== 404) {
      console.warn(`Warning: Could not delete test agent ${agentName}`);
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Clean up all evalsets for a test agent
 */
export async function cleanupTestEvalsets(agentName: string): Promise<void> {
  try {
    const response = await fetch(
      `${BASE_URL}/api/agents/${agentName}/evaluations/cleanup`,
      { method: 'DELETE' }
    );
    if (!response.ok && response.status !== 404) {
      console.warn(`Warning: Could not cleanup evalsets for ${agentName}`);
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Create a test evalset via API
 */
export async function createTestEvalset(
  agentName: string,
  name: string,
  description: string = 'Test evaluation set'
): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/agents/${agentName}/evaluations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      description,
      eval_cases: [],
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create test evalset: ${response.statusText}`);
  }

  const data = await response.json();
  return data.eval_set_id;
}
