/**
 * Phase 18: Evalset Format Validation
 * Ensures evalsets created through UI match ADK schema requirements
 */

import { test, expect, TEST_PROJECT } from './helpers';
import path from 'path';
import fs from 'fs/promises';

test.describe('Phase 18: Evalset Format Validation', () => {
  const agentPath = path.join(
    process.cwd(),
    'adk-service',
    'agents',
    TEST_PROJECT
  );

  // Clean up test evalsets before each test
  test.beforeEach(async ({ request }) => {
    await request.delete(`/api/agents/${TEST_PROJECT}/evaluations/cleanup`);
  });

  test('18.format.1: evalset created through API has required app_name in session_input', async ({
    page,
  }) => {
    // Create a new evalset with a test case via API
    const createResponse = await page.request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
      data: {
        name: 'Format Test',
        description: 'Testing ADK format compliance',
        eval_cases: [
          {
            eval_id: 'case-1',
            conversation: [
              {
                user_content: {
                  parts: [{ text: 'What is 1+1?' }],
                  role: 'user',
                },
                final_response: {
                  parts: [{ text: 'The answer is 2' }],
                  role: 'model',
                },
              },
            ],
          },
        ],
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const evalset = await createResponse.json();
    const evalsetId = evalset.eval_set_id;

    // Read the created evalset file
    const evalsetPath = path.join(
      agentPath,
      'evaluations',
      `${evalsetId}.test.json`
    );

    const evalsetContent = await fs.readFile(evalsetPath, 'utf-8');
    const evalsetData = JSON.parse(evalsetContent);

    // Verify ADK-compliant format
    expect(evalsetData).toHaveProperty('eval_set_id', evalsetId);
    expect(evalsetData).toHaveProperty('eval_cases');
    expect(Array.isArray(evalsetData.eval_cases)).toBe(true);
    expect(evalsetData.eval_cases.length).toBeGreaterThan(0);

    const firstCase = evalsetData.eval_cases[0];

    // Critical: session_input must have app_name (not appName)
    expect(firstCase).toHaveProperty('session_input');
    expect(firstCase.session_input).toHaveProperty(
      'app_name',
      TEST_PROJECT
    );

    // session_input should NOT have appName (camelCase)
    expect(firstCase.session_input).not.toHaveProperty('appName');

    // eval_case should NOT have root_agent_name (ADK rejects this)
    expect(firstCase).not.toHaveProperty('root_agent_name');

    // Verify conversation structure
    expect(firstCase).toHaveProperty('conversation');
    expect(Array.isArray(firstCase.conversation)).toBe(true);
    expect(firstCase.conversation.length).toBeGreaterThan(0);

    const firstTurn = firstCase.conversation[0];
    expect(firstTurn).toHaveProperty('user_content');
    expect(firstTurn).toHaveProperty('final_response');
    expect(firstTurn.user_content).toHaveProperty('role', 'user');
    expect(firstTurn.final_response).toHaveProperty('role', 'model');
  });

  test('18.format.2: multiple test cases all have app_name in session_input', async ({
    page,
  }) => {
    // Create a new evalset with multiple test cases via API
    const createResponse = await page.request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
      data: {
        name: 'Multi Format Test',
        description: 'Testing multiple cases',
        eval_cases: [
          {
            eval_id: 'case-1',
            conversation: [
              {
                user_content: { parts: [{ text: 'What is 1+1?' }], role: 'user' },
                final_response: { parts: [{ text: 'The answer is 2' }], role: 'model' },
              },
            ],
          },
          {
            eval_id: 'case-2',
            conversation: [
              {
                user_content: { parts: [{ text: 'What is 2+2?' }], role: 'user' },
                final_response: { parts: [{ text: 'The answer is 4' }], role: 'model' },
              },
            ],
          },
        ],
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const evalset = await createResponse.json();
    const evalsetId = evalset.eval_set_id;

    // Read and verify
    const evalsetPath = path.join(agentPath, 'evaluations', `${evalsetId}.test.json`);
    const evalsetContent = await fs.readFile(evalsetPath, 'utf-8');
    const evalsetData = JSON.parse(evalsetContent);

    expect(evalsetData.eval_cases.length).toBe(2);

    // Verify BOTH cases have app_name
    for (const evalCase of evalsetData.eval_cases) {
      expect(evalCase.session_input).toHaveProperty('app_name', TEST_PROJECT);
      expect(evalCase.session_input).not.toHaveProperty('appName');
      expect(evalCase).not.toHaveProperty('root_agent_name');
    }
  });
});
