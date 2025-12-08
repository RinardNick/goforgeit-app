/**
 * Phase 18.1: Full Google ADK Evaluation Data Model Tests
 *
 * Tests for the complete Google ADK evaluation system with:
 * - Multi-turn conversations (not just single Q&A)
 * - Tool trajectory tracking (expected sequence of tool calls)
 * - Session input configuration
 * - Intermediate responses (sub-agent outputs)
 * - Full EvalSet and EvalCase schema compliance
 *
 * Reference: https://google.github.io/adk-docs/evaluate/
 */

import { test, expect, TEST_PROJECT } from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 18.1: ADK-Compatible Data Model', () => {
  // Clean up evaluations before tests
  test.beforeEach(async ({ request }) => {
    await request.delete(`/api/agents/${TEST_PROJECT}/evaluations/cleanup`);
  });

  test.describe('EvalSet Schema', () => {
    test('Can create evalset with full ADK schema', async ({ page }) => {
      // GIVEN: Navigate to evaluations page
      await page.goto(`/${TEST_PROJECT}/evaluations`);
      await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Create a new evalset
      await page.locator('[data-testid="create-evalset-btn"]').click();
      const dialog = page.locator('[data-testid="create-evalset-dialog"]');
      await expect(dialog).toBeVisible();

      await dialog.locator('input[name="name"]').fill('ADK Full Schema Test');
      await dialog.locator('textarea[name="description"]').fill('Testing complete ADK EvalSet schema');
      await dialog.locator('button[type="submit"]').click();

      // THEN: Evalset should be created and visible
      await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="evalset-card"]')).toContainText('ADK Full Schema Test');

      // AND: When we fetch it via API, it should have ADK schema fields
      await page.locator('[data-testid="evalset-card"]').click();
      await expect(page).toHaveURL(/\/evaluations\/[^/]+$/);

      // Verify the evalset has the required ADK fields via API
      const response = await page.request.get(page.url().replace('/', '/api/agents/'));
      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      // Should have ADK schema fields
      expect(data.evalset).toHaveProperty('eval_set_id');
      expect(data.evalset).toHaveProperty('name', 'ADK Full Schema Test');
      expect(data.evalset).toHaveProperty('description', 'Testing complete ADK EvalSet schema');
      expect(data.evalset).toHaveProperty('eval_cases');
      expect(Array.isArray(data.evalset.eval_cases)).toBeTruthy();
    });

    test('EvalSet stores in .test.json format', async ({ page, request }) => {
      // GIVEN: Create an evalset
      await page.goto(`/${TEST_PROJECT}/evaluations`);
      await page.locator('[data-testid="create-evalset-btn"]').click();
      await page.locator('input[name="name"]').fill('Test JSON Format');
      await page.locator('button[type="submit"]').click();
      await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible();

      // WHEN: Fetch the evalset
      const card = page.locator('[data-testid="evalset-card"]').first();
      await card.click();

      const apiUrl = page.url().replace('/', '/api/agents/');
      const response = await request.get(apiUrl);
      const data = await response.json();

      // THEN: Should be in ADK .test.json format
      expect(data.evalset).toHaveProperty('eval_set_id');
      expect(data.evalset.eval_set_id).toMatch(/^[a-zA-Z0-9_-]+$/); // Valid ID format
      expect(data.evalset).toHaveProperty('eval_cases');
    });
  });

  test.describe('Multi-Turn Conversations', () => {
    test('Can create eval case with multi-turn conversation', async ({ page }) => {
      // GIVEN: Evalset detail page
      await page.goto(`/${TEST_PROJECT}/evaluations`);
      await page.locator('[data-testid="create-evalset-btn"]').click();
      await page.locator('input[name="name"]').fill('Multi-Turn Test');
      await page.locator('button[type="submit"]').click();
      await page.locator('[data-testid="evalset-card"]').click();

      // WHEN: Add a conversation with multiple turns
      await page.locator('[data-testid="add-conversation-btn"]').click();

      // First turn
      await page.locator('[data-testid="user-message-input-0"]').fill('What is 2+2?');
      await page.locator('[data-testid="expected-response-input-0"]').fill('2+2 equals 4');

      // Add second turn
      await page.locator('[data-testid="add-turn-btn"]').click();
      await page.locator('[data-testid="user-message-input-1"]').fill('What about 3+3?');
      await page.locator('[data-testid="expected-response-input-1"]').fill('3+3 equals 6');

      // Save conversation
      await page.locator('[data-testid="save-conversation-btn"]').click();

      // THEN: Conversation should be visible with 2 turns
      await expect(page.locator('[data-testid="conversation-card"]')).toBeVisible();
      await expect(page.locator('[data-testid="turn-indicator"]')).toContainText('2 turns');
    });

    test('Each turn has invocation_id', async ({ page, request }) => {
      // GIVEN: Create conversation with 2 turns
      await page.goto(`/${TEST_PROJECT}/evaluations`);
      await page.locator('[data-testid="create-evalset-btn"]').click();
      await page.locator('input[name="name"]').fill('Invocation ID Test');
      await page.locator('button[type="submit"]').click();
      await page.locator('[data-testid="evalset-card"]').click();

      await page.locator('[data-testid="add-conversation-btn"]').click();
      await page.locator('[data-testid="user-message-input-0"]').fill('Turn 1');
      await page.locator('[data-testid="expected-response-input-0"]').fill('Response 1');
      await page.locator('[data-testid="add-turn-btn"]').click();
      await page.locator('[data-testid="user-message-input-1"]').fill('Turn 2');
      await page.locator('[data-testid="expected-response-input-1"]').fill('Response 2');
      await page.locator('[data-testid="save-conversation-btn"]').click();

      // WHEN: Fetch the evalset
      const apiUrl = page.url().replace('/', '/api/agents/');
      const response = await request.get(apiUrl);
      const data = await response.json();

      // THEN: Each turn should have unique invocation_id
      const evalCase = data.evalset.eval_cases[0];
      expect(evalCase.conversation).toHaveLength(2);

      const turn1 = evalCase.conversation[0];
      const turn2 = evalCase.conversation[1];

      expect(turn1).toHaveProperty('invocation_id');
      expect(turn2).toHaveProperty('invocation_id');
      expect(turn1.invocation_id).not.toBe(turn2.invocation_id);

      // Should be UUID format
      expect(turn1.invocation_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    test('Turn has user_content with parts array', async ({ page, request }) => {
      // GIVEN: Create conversation
      await page.goto(`/${TEST_PROJECT}/evaluations`);
      await page.locator('[data-testid="create-evalset-btn"]').click();
      await page.locator('input[name="name"]').fill('User Content Test');
      await page.locator('button[type="submit"]').click();
      await page.locator('[data-testid="evalset-card"]').click();

      await page.locator('[data-testid="add-conversation-btn"]').click();
      await page.locator('[data-testid="user-message-input-0"]').fill('Hello agent');
      await page.locator('[data-testid="expected-response-input-0"]').fill('Hello user');
      await page.locator('[data-testid="save-conversation-btn"]').click();

      // WHEN: Fetch conversation
      const apiUrl = page.url().replace('/', '/api/agents/');
      const response = await request.get(apiUrl);
      const data = await response.json();

      // THEN: user_content should have parts array with role
      const turn = data.evalset.eval_cases[0].conversation[0];
      expect(turn).toHaveProperty('user_content');
      expect(turn.user_content).toHaveProperty('parts');
      expect(Array.isArray(turn.user_content.parts)).toBeTruthy();
      expect(turn.user_content.parts[0]).toHaveProperty('text', 'Hello agent');
      expect(turn.user_content).toHaveProperty('role', 'user');
    });

    test('Turn has final_response with expected output', async ({ page, request }) => {
      // GIVEN: Create conversation
      await page.goto(`/${TEST_PROJECT}/evaluations`);
      await page.locator('[data-testid="create-evalset-btn"]').click();
      await page.locator('input[name="name"]').fill('Final Response Test');
      await page.locator('button[type="submit"]').click();
      await page.locator('[data-testid="evalset-card"]').click();

      await page.locator('[data-testid="add-conversation-btn"]').click();
      await page.locator('[data-testid="user-message-input-0"]').fill('Test input');
      await page.locator('[data-testid="expected-response-input-0"]').fill('Expected output');
      await page.locator('[data-testid="save-conversation-btn"]').click();

      // WHEN: Fetch conversation
      const apiUrl = page.url().replace('/', '/api/agents/');
      const response = await request.get(apiUrl);
      const data = await response.json();

      // THEN: final_response should have parts array
      const turn = data.evalset.eval_cases[0].conversation[0];
      expect(turn).toHaveProperty('final_response');
      expect(turn.final_response).toHaveProperty('parts');
      expect(turn.final_response.parts[0]).toHaveProperty('text', 'Expected output');
      expect(turn.final_response).toHaveProperty('role', 'model');
    });
  });

  test.describe('Tool Trajectory Tracking', () => {
    test('Can specify expected tool calls for a turn', async ({ page }) => {
      // GIVEN: Conversation editor
      await page.goto(`/${TEST_PROJECT}/evaluations`);
      await page.locator('[data-testid="create-evalset-btn"]').click();
      await page.locator('input[name="name"]').fill('Tool Trajectory Test');
      await page.locator('button[type="submit"]').click();
      await page.locator('[data-testid="evalset-card"]').click();

      await page.locator('[data-testid="add-conversation-btn"]').click();
      await page.locator('[data-testid="user-message-input-0"]').fill('Search for Python docs');
      await page.locator('[data-testid="expected-response-input-0"]').fill('Here are the docs');

      // WHEN: Add expected tool trajectory
      await page.locator('[data-testid="add-tool-trajectory-btn"]').click();

      // Add first tool
      await page.locator('[data-testid="tool-selector-0"]').selectOption('google_search');
      await page.locator('[data-testid="tool-args-input-0"]').fill('{"query": "Python documentation"}');

      // Add second tool
      await page.locator('[data-testid="add-tool-to-trajectory-btn"]').click();
      await page.locator('[data-testid="tool-selector-1"]').selectOption('code_execution');
      await page.locator('[data-testid="tool-args-input-1"]').fill('{"code": "print(\'test\')"}');

      await page.locator('[data-testid="save-conversation-btn"]').click();

      // THEN: Tool trajectory should be visible
      await expect(page.locator('[data-testid="tool-trajectory-indicator"]')).toBeVisible();
      await expect(page.locator('[data-testid="tool-trajectory-indicator"]')).toContainText('2 tools');
    });

    test('Tool trajectory stored in intermediate_data.tool_uses', async ({ page, request }) => {
      // GIVEN: Conversation with tool trajectory
      await page.goto(`/${TEST_PROJECT}/evaluations`);
      await page.locator('[data-testid="create-evalset-btn"]').click();
      await page.locator('input[name="name"]').fill('Tool Uses Storage Test');
      await page.locator('button[type="submit"]').click();
      await page.locator('[data-testid="evalset-card"]').click();

      await page.locator('[data-testid="add-conversation-btn"]').click();
      await page.locator('[data-testid="user-message-input-0"]').fill('Use tools');
      await page.locator('[data-testid="add-tool-trajectory-btn"]').click();
      await page.locator('[data-testid="tool-selector-0"]').selectOption('google_search');
      await page.locator('[data-testid="tool-args-input-0"]').fill('{"query": "test"}');
      await page.locator('[data-testid="save-conversation-btn"]').click();

      // WHEN: Fetch conversation
      const apiUrl = page.url().replace('/', '/api/agents/');
      const response = await request.get(apiUrl);
      const data = await response.json();

      // THEN: Should have tool_uses in intermediate_data
      const turn = data.evalset.eval_cases[0].conversation[0];
      expect(turn).toHaveProperty('intermediate_data');
      expect(turn.intermediate_data).toHaveProperty('tool_uses');
      expect(Array.isArray(turn.intermediate_data.tool_uses)).toBeTruthy();

      const toolUse = turn.intermediate_data.tool_uses[0];
      expect(toolUse).toHaveProperty('id');
      expect(toolUse).toHaveProperty('name', 'google_search');
      expect(toolUse).toHaveProperty('args');
      expect(toolUse.args).toHaveProperty('query', 'test');
    });

    test('Tool uses have unique IDs', async ({ page, request }) => {
      // GIVEN: Conversation with 2 tool calls
      await page.goto(`/${TEST_PROJECT}/evaluations`);
      await page.locator('[data-testid="create-evalset-btn"]').click();
      await page.locator('input[name="name"]').fill('Tool ID Test');
      await page.locator('button[type="submit"]').click();
      await page.locator('[data-testid="evalset-card"]').click();

      await page.locator('[data-testid="add-conversation-btn"]').click();
      await page.locator('[data-testid="user-message-input-0"]').fill('Use tools');
      await page.locator('[data-testid="add-tool-trajectory-btn"]').click();
      await page.locator('[data-testid="tool-selector-0"]').selectOption('google_search');
      await page.locator('[data-testid="add-tool-to-trajectory-btn"]').click();
      await page.locator('[data-testid="tool-selector-1"]').selectOption('code_execution');
      await page.locator('[data-testid="save-conversation-btn"]').click();

      // WHEN: Fetch conversation
      const apiUrl = page.url().replace('/', '/api/agents/');
      const response = await request.get(apiUrl);
      const data = await response.json();

      // THEN: Each tool should have unique ID
      const toolUses = data.evalset.eval_cases[0].conversation[0].intermediate_data.tool_uses;
      expect(toolUses[0].id).not.toBe(toolUses[1].id);
      expect(toolUses[0].id).toMatch(/^adk-/); // ADK format
    });
  });

  test.describe('Session Input Configuration', () => {
    test('EvalCase has session_input configuration', async ({ page, request }) => {
      // GIVEN: Create conversation
      await page.goto(`/${TEST_PROJECT}/evaluations`);
      await page.locator('[data-testid="create-evalset-btn"]').click();
      await page.locator('input[name="name"]').fill('Session Input Test');
      await page.locator('button[type="submit"]').click();
      await page.locator('[data-testid="evalset-card"]').click();

      await page.locator('[data-testid="add-conversation-btn"]').click();

      // Configure session input
      await page.locator('[data-testid="session-config-btn"]').click();
      await page.locator('[data-testid="user-id-input"]').fill('test-user-123');
      await page.locator('[data-testid="initial-state-input"]').fill('{"key": "value"}');

      await page.locator('[data-testid="user-message-input-0"]').fill('Test');
      await page.locator('[data-testid="save-conversation-btn"]').click();

      // WHEN: Fetch conversation
      const apiUrl = page.url().replace('/', '/api/agents/');
      const response = await request.get(apiUrl);
      const data = await response.json();

      // THEN: Should have session_input with config
      const evalCase = data.evalset.eval_cases[0];
      expect(evalCase).toHaveProperty('session_input');
      expect(evalCase.session_input).toHaveProperty('app_name', TEST_PROJECT);
      expect(evalCase.session_input).toHaveProperty('user_id', 'test-user-123');
      expect(evalCase.session_input).toHaveProperty('state');
      expect(evalCase.session_input.state).toEqual({ key: 'value' });
    });

    test('Session input defaults to agent name and auto user ID', async ({ page, request }) => {
      // GIVEN: Create conversation without explicit session config
      await page.goto(`/${TEST_PROJECT}/evaluations`);
      await page.locator('[data-testid="create-evalset-btn"]').click();
      await page.locator('input[name="name"]').fill('Default Session Test');
      await page.locator('button[type="submit"]').click();
      await page.locator('[data-testid="evalset-card"]').click();

      await page.locator('[data-testid="add-conversation-btn"]').click();
      await page.locator('[data-testid="user-message-input-0"]').fill('Test');
      await page.locator('[data-testid="save-conversation-btn"]').click();

      // WHEN: Fetch conversation
      const apiUrl = page.url().replace('/', '/api/agents/');
      const response = await request.get(apiUrl);
      const data = await response.json();

      // THEN: Should have default session_input
      const evalCase = data.evalset.eval_cases[0];
      expect(evalCase.session_input.app_name).toBe(TEST_PROJECT);
      expect(evalCase.session_input).toHaveProperty('user_id');
      expect(evalCase.session_input.user_id).toMatch(/^eval-user-/);
    });
  });

  test.describe('Intermediate Responses (Multi-Agent)', () => {
    test('Can add expected intermediate responses for sub-agents', async ({ page }) => {
      // GIVEN: Conversation editor
      await page.goto(`/${TEST_PROJECT}/evaluations`);
      await page.locator('[data-testid="create-evalset-btn"]').click();
      await page.locator('input[name="name"]').fill('Intermediate Response Test');
      await page.locator('button[type="submit"]').click();
      await page.locator('[data-testid="evalset-card"]').click();

      await page.locator('[data-testid="add-conversation-btn"]').click();
      await page.locator('[data-testid="user-message-input-0"]').fill('Multi-agent query');

      // WHEN: Add expected intermediate response
      await page.locator('[data-testid="add-intermediate-response-btn"]').click();
      await page.locator('[data-testid="sub-agent-selector"]').selectOption('copywriting_agent');
      await page.locator('[data-testid="intermediate-response-text"]').fill('Sub-agent draft response');

      await page.locator('[data-testid="save-conversation-btn"]').click();

      // THEN: Intermediate response indicator should be visible
      await expect(page.locator('[data-testid="intermediate-response-indicator"]')).toBeVisible();
    });

    test('Intermediate responses stored correctly', async ({ page, request }) => {
      // GIVEN: Conversation with intermediate response
      await page.goto(`/${TEST_PROJECT}/evaluations`);
      await page.locator('[data-testid="create-evalset-btn"]').click();
      await page.locator('input[name="name"]').fill('Intermediate Storage Test');
      await page.locator('button[type="submit"]').click();
      await page.locator('[data-testid="evalset-card"]').click();

      await page.locator('[data-testid="add-conversation-btn"]').click();
      await page.locator('[data-testid="user-message-input-0"]').fill('Test');
      await page.locator('[data-testid="add-intermediate-response-btn"]').click();
      await page.locator('[data-testid="sub-agent-selector"]').selectOption('copywriting_agent');
      await page.locator('[data-testid="intermediate-response-text"]').fill('Draft text');
      await page.locator('[data-testid="save-conversation-btn"]').click();

      // WHEN: Fetch conversation
      const apiUrl = page.url().replace('/', '/api/agents/');
      const response = await request.get(apiUrl);
      const data = await response.json();

      // THEN: Should have intermediate_responses in correct format
      const turn = data.evalset.eval_cases[0].conversation[0];
      expect(turn.intermediate_data).toHaveProperty('intermediate_responses');
      expect(Array.isArray(turn.intermediate_data.intermediate_responses)).toBeTruthy();

      const intermediateResp = turn.intermediate_data.intermediate_responses[0];
      expect(intermediateResp).toHaveLength(2);
      expect(intermediateResp[0]).toBe('copywriting_agent'); // Agent name
      expect(Array.isArray(intermediateResp[1])).toBeTruthy(); // Response parts
      expect(intermediateResp[1][0]).toHaveProperty('text', 'Draft text');
    });
  });

  test.describe('EvalCase eval_id', () => {
    test('Each EvalCase has unique eval_id', async ({ page, request }) => {
      // GIVEN: Create evalset with 2 conversations
      await page.goto(`/${TEST_PROJECT}/evaluations`);
      await page.locator('[data-testid="create-evalset-btn"]').click();
      await page.locator('input[name="name"]').fill('Eval ID Test');
      await page.locator('button[type="submit"]').click();
      await page.locator('[data-testid="evalset-card"]').click();

      // First conversation
      await page.locator('[data-testid="add-conversation-btn"]').click();
      await page.locator('[data-testid="user-message-input-0"]').fill('Conversation 1');
      await page.locator('[data-testid="save-conversation-btn"]').click();

      // Second conversation
      await page.locator('[data-testid="add-conversation-btn"]').click();
      await page.locator('[data-testid="user-message-input-0"]').fill('Conversation 2');
      await page.locator('[data-testid="save-conversation-btn"]').click();

      // WHEN: Fetch evalset
      const apiUrl = page.url().replace('/', '/api/agents/');
      const response = await request.get(apiUrl);
      const data = await response.json();

      // THEN: Each eval case should have unique eval_id
      expect(data.evalset.eval_cases).toHaveLength(2);
      const evalCase1 = data.evalset.eval_cases[0];
      const evalCase2 = data.evalset.eval_cases[1];

      expect(evalCase1).toHaveProperty('eval_id');
      expect(evalCase2).toHaveProperty('eval_id');
      expect(evalCase1.eval_id).not.toBe(evalCase2.eval_id);
      expect(evalCase1.eval_id).toMatch(/^eval-case-/);
    });
  });
});
