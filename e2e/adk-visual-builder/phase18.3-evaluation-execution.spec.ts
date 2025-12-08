import { test, expect } from '@playwright/test';
import { createTestAgent, deleteTestAgent, cleanupTestEvalsets } from '../helpers/adk-test-helpers';

test.describe('Phase 18.3: Evaluation Execution Engine', () => {
  const testAgentName = 'test-eval-execution-agent';
  let evalsetId: string;

  test.beforeAll(async () => {
    await createTestAgent(testAgentName, 'Test agent for evaluation execution');
  });

  test.afterAll(async () => {
    await cleanupTestEvalsets(testAgentName);
    await deleteTestAgent(testAgentName);
  });

  test.describe('Run Evaluation Button', () => {
    test('User can run an evaluation from the evalset detail page', async ({ page }) => {
      // GIVEN: User has created an evalset with one simple conversation
      await page.goto(`/${testAgentName}/evaluations`);

      // Create evalset
      await page.click('[data-testid="create-evalset-btn"]');
      await page.fill('[name="name"]', 'Simple Execution Test');
      await page.fill('[name="description"]', 'Test evaluation execution');
      await page.click('[data-testid="confirm-create-evalset"]');

      // Get evalset ID from URL
      await page.waitForURL(/\/evaluations\/.+$/);
      const url = page.url();
      evalsetId = url.split('/evaluations/')[1];

      // Add a simple conversation
      await page.click('[data-testid="add-conversation-btn"]');
      await page.fill('[data-testid="user-message-input-0"]', 'What is 2+2?');
      await page.fill('[data-testid="expected-response-input-0"]', 'The answer is 4.');
      await page.click('[data-testid="save-conversation-btn"]');

      // WHEN: User clicks "Run Evaluation" button
      await page.click('[data-testid="run-evaluation-btn"]');

      // THEN: Execution starts and shows progress
      await expect(page.locator('[data-testid="evaluation-progress"]')).toBeVisible();
      await expect(page.locator('text=Running evaluation...')).toBeVisible();
    });

    test('Running evaluation shows which eval case is being tested', async ({ page }) => {
      // GIVEN: Evalset with 2 conversations
      await page.goto(`/${testAgentName}/evaluations/${evalsetId}`);

      // WHEN: User runs the evaluation
      await page.click('[data-testid="run-evaluation-btn"]');

      // THEN: Shows current eval case progress
      await expect(page.locator('[data-testid="current-eval-case"]')).toBeVisible();
      await expect(page.locator('[data-testid="current-eval-case"]')).toContainText(/Case \d+ of \d+/);
    });
  });

  test.describe('Multi-Turn Conversation Execution', () => {
    test('Executes multi-turn conversation maintaining session state', async ({ page, request }) => {
      // GIVEN: Evalset with a multi-turn conversation
      await page.goto(`/${testAgentName}/evaluations`);

      // Create new evalset
      await page.click('[data-testid="create-evalset-btn"]');
      await page.fill('[name="name"]', 'Multi-Turn Test');
      await page.click('[data-testid="confirm-create-evalset"]');

      // Wait for redirect
      await page.waitForURL(/\/evaluations\/.+$/);
      const newEvalsetId = page.url().split('/evaluations/')[1];

      // Create multi-turn conversation
      await page.click('[data-testid="add-conversation-btn"]');

      // Turn 1
      await page.fill('[data-testid="user-message-input-0"]', 'My name is Alice');
      await page.fill('[data-testid="expected-response-input-0"]', 'Hello Alice');

      // Add Turn 2
      await page.click('[data-testid="add-turn-btn"]');
      await page.fill('[data-testid="user-message-input-1"]', 'What is my name?');
      await page.fill('[data-testid="expected-response-input-1"]', 'Your name is Alice');

      await page.click('[data-testid="save-conversation-btn"]');

      // WHEN: User runs the evaluation
      await page.click('[data-testid="run-evaluation-btn"]');

      // Wait for completion
      await expect(page.locator('[data-testid="evaluation-complete"]')).toBeVisible({ timeout: 60000 });

      // THEN: Check that run results were created
      const response = await request.get(`/api/agents/${testAgentName}/evaluations/${newEvalsetId}`);
      const data = await response.json();

      expect(data.evalset.runs).toBeDefined();
      expect(data.evalset.runs.length).toBeGreaterThan(0);

      const latestRun = data.evalset.runs[data.evalset.runs.length - 1];
      expect(latestRun.run_id).toBeDefined();
      expect(latestRun.results).toBeDefined();
      expect(latestRun.results.length).toBe(1); // 1 eval case
    });
  });

  test.describe('Session Management', () => {
    test('Creates separate session for each eval case', async ({ page, request }) => {
      // GIVEN: Evalset with 2 separate conversations
      await page.goto(`/${testAgentName}/evaluations`);

      await page.click('[data-testid="create-evalset-btn"]');
      await page.fill('[name="name"]', 'Session Isolation Test');
      await page.click('[data-testid="confirm-create-evalset"]');

      await page.waitForURL(/\/evaluations\/.+$/);
      const newEvalsetId = page.url().split('/evaluations/')[1];

      // Create conversation 1
      await page.click('[data-testid="add-conversation-btn"]');
      await page.fill('[data-testid="user-message-input-0"]', 'Set counter to 1');
      await page.fill('[data-testid="expected-response-input-0"]', 'Counter set to 1');
      await page.click('[data-testid="save-conversation-btn"]');

      // Create conversation 2
      await page.click('[data-testid="add-conversation-btn"]');
      await page.fill('[data-testid="user-message-input-0"]', 'What is the counter?');
      await page.fill('[data-testid="expected-response-input-0"]', 'I don\'t have a counter');
      await page.click('[data-testid="save-conversation-btn"]');

      // WHEN: User runs evaluation
      await page.click('[data-testid="run-evaluation-btn"]');
      await expect(page.locator('[data-testid="evaluation-complete"]')).toBeVisible({ timeout: 60000 });

      // THEN: Each conversation should have had its own isolated session
      const response = await request.get(`/api/agents/${testAgentName}/evaluations/${newEvalsetId}`);
      const data = await response.json();
      const latestRun = data.evalset.runs[data.evalset.runs.length - 1];

      // Verify 2 separate eval cases were executed
      expect(latestRun.results.length).toBe(2);
    });
  });

  test.describe('Capture Actual Outputs', () => {
    test('Captures agent responses for each turn', async ({ page, request }) => {
      // GIVEN: Simple evalset
      await page.goto(`/${testAgentName}/evaluations`);

      await page.click('[data-testid="create-evalset-btn"]');
      await page.fill('[name="name"]', 'Response Capture Test');
      await page.click('[data-testid="confirm-create-evalset"]');

      await page.waitForURL(/\/evaluations\/.+$/);
      const newEvalsetId = page.url().split('/evaluations/')[1];

      await page.click('[data-testid="add-conversation-btn"]');
      await page.fill('[data-testid="user-message-input-0"]', 'Say hello');
      await page.fill('[data-testid="expected-response-input-0"]', 'Hello!');
      await page.click('[data-testid="save-conversation-btn"]');

      // WHEN: Run evaluation
      await page.click('[data-testid="run-evaluation-btn"]');
      await expect(page.locator('[data-testid="evaluation-complete"]')).toBeVisible({ timeout: 60000 });

      // THEN: Actual response should be captured
      const response = await request.get(`/api/agents/${testAgentName}/evaluations/${newEvalsetId}`);
      const data = await response.json();
      const latestRun = data.evalset.runs[data.evalset.runs.length - 1];
      const firstCase = latestRun.results[0];
      const firstTurn = firstCase.turns[0];

      expect(firstTurn.actual_response).toBeDefined();
      expect(firstTurn.actual_response.parts).toBeDefined();
      expect(firstTurn.actual_response.parts.length).toBeGreaterThan(0);
      expect(typeof firstTurn.actual_response.parts[0].text).toBe('string');
    });

    test('Captures tool calls made during evaluation', async ({ page, request }) => {
      // GIVEN: Evalset expecting a specific tool call
      await page.goto(`/${testAgentName}/evaluations`);

      await page.click('[data-testid="create-evalset-btn"]');
      await page.fill('[name="name"]', 'Tool Call Capture Test');
      await page.click('[data-testid="confirm-create-evalset"]');

      await page.waitForURL(/\/evaluations\/.+$/);
      const newEvalsetId = page.url().split('/evaluations/')[1];

      // Create conversation with expected tool call
      await page.click('[data-testid="add-conversation-btn"]');
      await page.fill('[data-testid="user-message-input-0"]', 'Search for Python documentation');
      await page.fill('[data-testid="expected-response-input-0"]', 'I found the documentation');

      // Add expected tool trajectory
      await page.click('[data-testid="add-tool-trajectory-btn"]');
      await page.click('[data-testid="add-tool-to-trajectory-btn"]');
      await page.selectOption('[data-testid="tool-selector-0"]', 'google_search');
      await page.fill('[data-testid="tool-args-input-0"]', '{"query": "Python documentation"}');
      await page.click('[data-testid="save-tool-trajectory-btn"]');

      await page.click('[data-testid="save-conversation-btn"]');

      // WHEN: Run evaluation
      await page.click('[data-testid="run-evaluation-btn"]');
      await expect(page.locator('[data-testid="evaluation-complete"]')).toBeVisible({ timeout: 60000 });

      // THEN: Actual tool calls should be captured
      const response = await request.get(`/api/agents/${testAgentName}/evaluations/${newEvalsetId}`);
      const data = await response.json();
      const latestRun = data.evalset.runs[data.evalset.runs.length - 1];
      const firstCase = latestRun.results[0];
      const firstTurn = firstCase.turns[0];

      expect(firstTurn.actual_tool_calls).toBeDefined();
      expect(Array.isArray(firstTurn.actual_tool_calls)).toBe(true);
    });
  });

  test.describe('Progress Tracking', () => {
    test('Shows progress percentage during execution', async ({ page }) => {
      // GIVEN: Evalset with multiple conversations
      await page.goto(`/${testAgentName}/evaluations`);

      await page.click('[data-testid="create-evalset-btn"]');
      await page.fill('[name="name"]', 'Progress Test');
      await page.click('[data-testid="confirm-create-evalset"]');

      await page.waitForURL(/\/evaluations\/.+$/);

      // Add 3 conversations
      for (let i = 0; i < 3; i++) {
        await page.click('[data-testid="add-conversation-btn"]');
        await page.fill('[data-testid="user-message-input-0"]', `Test message ${i + 1}`);
        await page.fill('[data-testid="expected-response-input-0"]', `Response ${i + 1}`);
        await page.click('[data-testid="save-conversation-btn"]');
      }

      // WHEN: Start evaluation
      await page.click('[data-testid="run-evaluation-btn"]');

      // THEN: Progress indicator should show
      await expect(page.locator('[data-testid="progress-percentage"]')).toBeVisible();

      // Should eventually reach 100%
      await expect(page.locator('[data-testid="progress-percentage"]')).toContainText('100%', { timeout: 60000 });
    });

    test('Disables Run button during execution', async ({ page }) => {
      // GIVEN: Evalset ready to run
      await page.goto(`/${testAgentName}/evaluations/${evalsetId}`);

      // WHEN: User starts evaluation
      await page.click('[data-testid="run-evaluation-btn"]');

      // THEN: Button should be disabled during execution
      await expect(page.locator('[data-testid="run-evaluation-btn"]')).toBeDisabled();

      // Wait for completion
      await expect(page.locator('[data-testid="evaluation-complete"]')).toBeVisible({ timeout: 60000 });

      // Button should be enabled again
      await expect(page.locator('[data-testid="run-evaluation-btn"]')).toBeEnabled();
    });
  });

  test.describe('Error Handling', () => {
    test('Shows error message if evaluation fails', async ({ page }) => {
      // GIVEN: Evalset with invalid configuration
      await page.goto(`/${testAgentName}/evaluations`);

      await page.click('[data-testid="create-evalset-btn"]');
      await page.fill('[name="name"]', 'Error Test');
      await page.click('[data-testid="confirm-create-evalset"]');

      await page.waitForURL(/\/evaluations\/.+$/);

      // Don't add any conversations - empty evalset

      // WHEN: Try to run evaluation
      await page.click('[data-testid="run-evaluation-btn"]');

      // THEN: Should show error
      await expect(page.locator('[data-testid="evaluation-error"]')).toBeVisible();
      await expect(page.locator('text=Cannot run evaluation')).toBeVisible();
    });
  });
});
