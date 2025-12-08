/**
 * Phase 18: Evaluation System Tests
 *
 * Tests for the agent evaluation system that allows testing agent responses
 * against expected outputs. This enables quality assurance and regression
 * testing for agent behaviors.
 *
 * Reference: ADK Evaluation - https://google.github.io/adk-docs/evaluate/
 *
 * Key concepts:
 * - Evalset: A collection of test cases for an agent
 * - Test case: Input message + expected output/tool calls
 * - Run: Execution of all test cases with results
 * - Scoring: Pass/fail based on output matching and tool call verification
 */

import { test, expect, TEST_PROJECT } from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 18: Evaluation System', () => {
  // Clean up evaluations before each test to ensure isolation
  test.beforeEach(async ({ request }) => {
    await request.delete(`/api/agents/${TEST_PROJECT}/evaluations/cleanup`);
  });

  test.describe('Story 18.1: Evaluation UI & Navigation', () => {
    test('Project card has Evaluations link', async ({ page }) => {
      // GIVEN: Navigate to the ADK agents list page
      await page.goto('/');
      await expect(page.locator(`[data-testid="project-card-${TEST_PROJECT}"]`)).toBeVisible({ timeout: 10000 });

      // THEN: The project card should have an Evaluations link
      const projectCard = page.locator(`[data-testid="project-card-${TEST_PROJECT}"]`);
      const evaluationsLink = projectCard.locator('[data-testid="evaluations-link"]');
      await expect(evaluationsLink).toBeVisible();
      await expect(evaluationsLink).toContainText(/eval/i);
    });

    test('Clicking Evaluations link navigates to evaluations page', async ({ page }) => {
      // GIVEN: On the ADK agents list page
      await page.goto('/');
      await expect(page.locator(`[data-testid="project-card-${TEST_PROJECT}"]`)).toBeVisible({ timeout: 10000 });

      // WHEN: Click the evaluations link
      const projectCard = page.locator(`[data-testid="project-card-${TEST_PROJECT}"]`);
      await projectCard.locator('[data-testid="evaluations-link"]').click();

      // THEN: Should navigate to evaluations page
      await expect(page).toHaveURL(new RegExp(`/${TEST_PROJECT}/evaluations`));
      await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();
    });

    test('Evaluations page shows empty state when no evalsets', async ({ page }) => {
      // GIVEN: Navigate to evaluations page with no evalsets
      await page.goto(`/${TEST_PROJECT}/evaluations`);
      await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible({ timeout: 10000 });

      // THEN: Should show empty state with CTA
      const emptyState = page.locator('[data-testid="evaluations-empty-state"]');
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText(/create.*first.*evaluation/i);
    });

    test('Empty state has "Create Evaluation" button', async ({ page }) => {
      // GIVEN: On evaluations page with empty state
      await page.goto(`/${TEST_PROJECT}/evaluations`);
      await expect(page.locator('[data-testid="evaluations-empty-state"]')).toBeVisible({ timeout: 10000 });

      // THEN: Should have a create button
      const createButton = page.locator('[data-testid="create-evalset-btn"]');
      await expect(createButton).toBeVisible();
      await expect(createButton).toContainText(/create/i);
    });
  });

  test.describe('Story 18.2: Evalset Definition', () => {
    test('Create Evaluation button opens create dialog', async ({ page }) => {
      // GIVEN: On evaluations page
      await page.goto(`/${TEST_PROJECT}/evaluations`);
      await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Click create button
      await page.locator('[data-testid="create-evalset-btn"]').click();

      // THEN: Dialog should open with name and description fields
      const dialog = page.locator('[data-testid="create-evalset-dialog"]');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('input[name="name"]')).toBeVisible();
      await expect(dialog.locator('textarea[name="description"]')).toBeVisible();
    });

    test('Can create a new evalset with name and description', async ({ page }) => {
      // GIVEN: Create dialog is open
      await page.goto(`/${TEST_PROJECT}/evaluations`);
      await page.locator('[data-testid="create-evalset-btn"]').click();
      const dialog = page.locator('[data-testid="create-evalset-dialog"]');
      await expect(dialog).toBeVisible();

      // WHEN: Fill in name and description, then submit
      await dialog.locator('input[name="name"]').fill('Basic Response Tests');
      await dialog.locator('textarea[name="description"]').fill('Tests for basic agent responses');
      await dialog.locator('[data-testid="confirm-create-evalset"]').click();

      // THEN: Dialog closes and evalset appears in list
      await expect(dialog).not.toBeVisible();
      const evalsetCard = page.locator('[data-testid="evalset-card"]').filter({ hasText: 'Basic Response Tests' });
      await expect(evalsetCard).toBeVisible();
    });

    test('Evalset card shows name and test count', async ({ page, request }) => {
      // GIVEN: Create an evalset via API
      await request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
        data: {
          name: 'Test Evalset',
          description: 'A test evalset',
          testCases: [],
        },
      });

      // WHEN: Navigate to evaluations page
      await page.goto(`/${TEST_PROJECT}/evaluations`);
      await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible({ timeout: 10000 });

      // THEN: Evalset card shows name and test count
      const evalsetCard = page.locator('[data-testid="evalset-card"]').filter({ hasText: 'Test Evalset' });
      await expect(evalsetCard).toBeVisible();
      await expect(evalsetCard.locator('[data-testid="evalset-test-count"]')).toContainText(/0 test/i);
    });

    test('Can delete an evalset', async ({ page, request }) => {
      // GIVEN: Create an evalset via API
      await request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
        data: {
          name: 'Evalset to Delete',
          description: 'Will be deleted',
          testCases: [],
        },
      });

      await page.goto(`/${TEST_PROJECT}/evaluations`);
      const evalsetCard = page.locator('[data-testid="evalset-card"]').filter({ hasText: 'Evalset to Delete' });
      await expect(evalsetCard).toBeVisible();

      // WHEN: Click delete button on the card
      await evalsetCard.locator('[data-testid="delete-evalset-btn"]').click();

      // Confirm deletion
      await page.locator('[data-testid="confirm-delete-evalset"]').click();

      // THEN: Evalset should be removed from the list
      await expect(evalsetCard).not.toBeVisible();
    });
  });

  test.describe('Story 18.3: Test Case Management', () => {
    test('Evalset detail page shows test case list', async ({ page, request }) => {
      // GIVEN: Create an evalset via API
      const response = await request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
        data: {
          name: 'Test Case Evalset',
          description: 'For testing test cases',
          testCases: [],
        },
      });
      const evalset = await response.json();

      // WHEN: Navigate to evalset detail page
      await page.goto(`/${TEST_PROJECT}/evaluations/${evalset.id}`);
      await expect(page.locator('[data-testid="evalset-detail-page"]')).toBeVisible({ timeout: 10000 });

      // THEN: Should show test cases section with empty state
      await expect(page.locator('[data-testid="test-cases-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="test-cases-empty-state"]')).toBeVisible();
    });

    test('Can add a test case with input and expected output', async ({ page, request }) => {
      // GIVEN: Create an evalset and navigate to its detail page
      const response = await request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
        data: {
          name: 'Add Test Case Evalset',
          description: 'For adding test cases',
          testCases: [],
        },
      });
      const evalset = await response.json();

      await page.goto(`/${TEST_PROJECT}/evaluations/${evalset.id}`);
      await expect(page.locator('[data-testid="evalset-detail-page"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Click add test case button and fill form
      await page.locator('[data-testid="add-test-case-btn"]').click();

      const testCaseForm = page.locator('[data-testid="test-case-form"]');
      await expect(testCaseForm).toBeVisible();

      await testCaseForm.locator('textarea[name="input"]').fill('What is 2+2?');
      await testCaseForm.locator('textarea[name="expectedOutput"]').fill('4');
      await testCaseForm.locator('[data-testid="save-test-case-btn"]').click();

      // THEN: Test case appears in the list
      const testCaseCard = page.locator('[data-testid="test-case-card"]').first();
      await expect(testCaseCard).toBeVisible();
      await expect(testCaseCard).toContainText('What is 2+2?');
    });

    test('Test case shows expected tool calls field', async ({ page, request }) => {
      // GIVEN: Create an evalset and navigate to its detail page
      const response = await request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
        data: {
          name: 'Tool Call Evalset',
          description: 'For testing tool calls',
          testCases: [],
        },
      });
      const evalset = await response.json();

      await page.goto(`/${TEST_PROJECT}/evaluations/${evalset.id}`);
      await page.locator('[data-testid="add-test-case-btn"]').click();

      // THEN: Form should have expected tool calls field
      const testCaseForm = page.locator('[data-testid="test-case-form"]');
      await expect(testCaseForm.locator('[data-testid="expected-tool-calls-input"]')).toBeVisible();
    });

    test('Can edit an existing test case', async ({ page, request }) => {
      // GIVEN: Create an evalset with a test case
      const response = await request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
        data: {
          name: 'Edit Test Case Evalset',
          description: 'For editing test cases',
          testCases: [
            { input: 'Original input', expectedOutput: 'Original output' },
          ],
        },
      });
      const evalset = await response.json();

      await page.goto(`/${TEST_PROJECT}/evaluations/${evalset.id}`);
      await expect(page.locator('[data-testid="test-case-card"]')).toBeVisible();

      // WHEN: Click edit on the test case
      await page.locator('[data-testid="test-case-card"]').first().locator('[data-testid="edit-test-case-btn"]').click();

      // Edit the input
      const testCaseForm = page.locator('[data-testid="test-case-form"]');
      await testCaseForm.locator('textarea[name="input"]').fill('Updated input');
      await testCaseForm.locator('[data-testid="save-test-case-btn"]').click();

      // THEN: Test case should show updated content
      await expect(page.locator('[data-testid="test-case-card"]').first()).toContainText('Updated input');
    });

    test('Can delete a test case', async ({ page, request }) => {
      // GIVEN: Create an evalset with a test case
      const response = await request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
        data: {
          name: 'Delete Test Case Evalset',
          description: 'For deleting test cases',
          testCases: [
            { input: 'Test to delete', expectedOutput: 'Will be deleted' },
          ],
        },
      });
      const evalset = await response.json();

      await page.goto(`/${TEST_PROJECT}/evaluations/${evalset.id}`);
      await expect(page.locator('[data-testid="test-case-card"]')).toBeVisible();

      // WHEN: Click delete on the test case
      await page.locator('[data-testid="test-case-card"]').first().locator('[data-testid="delete-test-case-btn"]').click();
      await page.locator('[data-testid="confirm-delete-test-case"]').click();

      // THEN: Test case should be removed
      await expect(page.locator('[data-testid="test-case-card"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="test-cases-empty-state"]')).toBeVisible();
    });
  });

  test.describe('Story 18.4: Run Evaluations', () => {
    test('Evalset detail page has Run Evaluation button', async ({ page, request }) => {
      // GIVEN: Create an evalset with test cases
      const response = await request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
        data: {
          name: 'Run Button Evalset',
          description: 'For testing run button',
          testCases: [
            { input: 'Hello', expectedOutput: 'Hi' },
          ],
        },
      });
      const evalset = await response.json();

      // WHEN: Navigate to evalset detail page
      await page.goto(`/${TEST_PROJECT}/evaluations/${evalset.id}`);
      await expect(page.locator('[data-testid="evalset-detail-page"]')).toBeVisible({ timeout: 10000 });

      // THEN: Run button should be visible
      await expect(page.locator('[data-testid="run-evaluation-btn"]')).toBeVisible();
    });

    test('Run Evaluation button is disabled when no test cases', async ({ page, request }) => {
      // GIVEN: Create an evalset with no test cases
      const response = await request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
        data: {
          name: 'Empty Run Evalset',
          description: 'No test cases',
          testCases: [],
        },
      });
      const evalset = await response.json();

      await page.goto(`/${TEST_PROJECT}/evaluations/${evalset.id}`);
      await expect(page.locator('[data-testid="evalset-detail-page"]')).toBeVisible({ timeout: 10000 });

      // THEN: Run button should be disabled
      await expect(page.locator('[data-testid="run-evaluation-btn"]')).toBeDisabled();
    });

    test('Running evaluation shows progress indicator', async ({ page, request }) => {
      // GIVEN: Create an evalset with test cases
      const response = await request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
        data: {
          name: 'Progress Evalset',
          description: 'For testing progress',
          testCases: [
            { input: 'Test 1', expectedOutput: 'Response 1' },
            { input: 'Test 2', expectedOutput: 'Response 2' },
          ],
        },
      });
      const evalset = await response.json();

      await page.goto(`/${TEST_PROJECT}/evaluations/${evalset.id}`);
      await expect(page.locator('[data-testid="run-evaluation-btn"]')).toBeVisible();

      // WHEN: Click run evaluation
      await page.locator('[data-testid="run-evaluation-btn"]').click();

      // THEN: Progress indicator should appear
      await expect(page.locator('[data-testid="evaluation-progress"]')).toBeVisible();
    });
  });

  test.describe('Story 18.5: Results & Scoring', () => {
    test('Results panel shows after evaluation completes', async ({ page, request }) => {
      // GIVEN: Create an evalset with a simple test case
      const response = await request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
        data: {
          name: 'Results Evalset',
          description: 'For testing results',
          testCases: [
            { input: 'Hello', expectedOutput: 'hello' },
          ],
        },
      });
      const evalset = await response.json();

      await page.goto(`/${TEST_PROJECT}/evaluations/${evalset.id}`);

      // WHEN: Run evaluation and wait for completion
      await page.locator('[data-testid="run-evaluation-btn"]').click();
      await expect(page.locator('[data-testid="evaluation-progress"]')).toBeVisible();

      // Wait for completion (with timeout for slow agents)
      await expect(page.locator('[data-testid="evaluation-results"]')).toBeVisible({ timeout: 60000 });

      // THEN: Results panel should show pass/fail status
      await expect(page.locator('[data-testid="results-summary"]')).toBeVisible();
    });

    test('Results show pass rate summary', async ({ page, request }) => {
      // GIVEN: Create and run an evalset
      const response = await request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
        data: {
          name: 'Pass Rate Evalset',
          description: 'For testing pass rate',
          testCases: [
            { input: 'Say hi', expectedOutput: 'hi' },
          ],
        },
      });
      const evalset = await response.json();

      await page.goto(`/${TEST_PROJECT}/evaluations/${evalset.id}`);
      await page.locator('[data-testid="run-evaluation-btn"]').click();
      await expect(page.locator('[data-testid="evaluation-results"]')).toBeVisible({ timeout: 60000 });

      // THEN: Pass rate should be displayed (e.g., "1/1 passed" or "100%")
      await expect(page.locator('[data-testid="pass-rate"]')).toBeVisible();
      await expect(page.locator('[data-testid="pass-rate"]')).toContainText(/\d+.*(?:passed|%)/i);
    });

    test('Individual test results show actual vs expected output', async ({ page, request }) => {
      // GIVEN: Create and run an evalset
      const response = await request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
        data: {
          name: 'Output Comparison Evalset',
          description: 'For testing output comparison',
          testCases: [
            { input: 'What is your name?', expectedOutput: 'agent' },
          ],
        },
      });
      const evalset = await response.json();

      await page.goto(`/${TEST_PROJECT}/evaluations/${evalset.id}`);
      await page.locator('[data-testid="run-evaluation-btn"]').click();
      await expect(page.locator('[data-testid="evaluation-results"]')).toBeVisible({ timeout: 60000 });

      // WHEN: Expand a test result
      const testResult = page.locator('[data-testid="test-result-card"]').first();
      await testResult.click();

      // THEN: Should show actual and expected output
      await expect(testResult.locator('[data-testid="expected-output"]')).toBeVisible();
      await expect(testResult.locator('[data-testid="actual-output"]')).toBeVisible();
    });

    test('Test result shows pass/fail status badge', async ({ page, request }) => {
      // GIVEN: Create and run an evalset
      const response = await request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
        data: {
          name: 'Status Badge Evalset',
          description: 'For testing status badges',
          testCases: [
            { input: 'Hello', expectedOutput: 'hello' },
          ],
        },
      });
      const evalset = await response.json();

      await page.goto(`/${TEST_PROJECT}/evaluations/${evalset.id}`);
      await page.locator('[data-testid="run-evaluation-btn"]').click();
      await expect(page.locator('[data-testid="evaluation-results"]')).toBeVisible({ timeout: 60000 });

      // THEN: Test result should have pass or fail badge
      const testResult = page.locator('[data-testid="test-result-card"]').first();
      const statusBadge = testResult.locator('[data-testid="result-status-badge"]');
      await expect(statusBadge).toBeVisible();
      await expect(statusBadge).toContainText(/pass|fail/i);
    });
  });

  test.describe('Story 18.6: Evaluation History', () => {
    test('Evalset detail page shows run history section', async ({ page, request }) => {
      // GIVEN: Create an evalset
      const response = await request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
        data: {
          name: 'History Evalset',
          description: 'For testing history',
          testCases: [{ input: 'Test', expectedOutput: 'test' }],
        },
      });
      const evalset = await response.json();

      // WHEN: Navigate to evalset detail page
      await page.goto(`/${TEST_PROJECT}/evaluations/${evalset.id}`);
      await expect(page.locator('[data-testid="evalset-detail-page"]')).toBeVisible({ timeout: 10000 });

      // THEN: History section should be visible
      await expect(page.locator('[data-testid="run-history-section"]')).toBeVisible();
    });

    test('Run history shows previous runs with timestamps', async ({ page, request }) => {
      // GIVEN: Create an evalset and run it
      const response = await request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
        data: {
          name: 'Timestamp Evalset',
          description: 'For testing timestamps',
          testCases: [{ input: 'Hello', expectedOutput: 'hi' }],
        },
      });
      const evalset = await response.json();

      await page.goto(`/${TEST_PROJECT}/evaluations/${evalset.id}`);
      await page.locator('[data-testid="run-evaluation-btn"]').click();
      await expect(page.locator('[data-testid="evaluation-results"]')).toBeVisible({ timeout: 60000 });

      // THEN: History should show the run with timestamp
      const historyItem = page.locator('[data-testid="history-item"]').first();
      await expect(historyItem).toBeVisible();
      await expect(historyItem.locator('[data-testid="run-timestamp"]')).toBeVisible();
    });

    test('Run history shows pass rate for each run', async ({ page, request }) => {
      // GIVEN: Create an evalset and run it
      const response = await request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
        data: {
          name: 'History Pass Rate Evalset',
          description: 'For testing history pass rate',
          testCases: [{ input: 'Test', expectedOutput: 'test' }],
        },
      });
      const evalset = await response.json();

      await page.goto(`/${TEST_PROJECT}/evaluations/${evalset.id}`);
      await page.locator('[data-testid="run-evaluation-btn"]').click();
      await expect(page.locator('[data-testid="evaluation-results"]')).toBeVisible({ timeout: 60000 });

      // THEN: History item should show pass rate
      const historyItem = page.locator('[data-testid="history-item"]').first();
      await expect(historyItem.locator('[data-testid="history-pass-rate"]')).toBeVisible();
    });

    test('Can view results from a previous run', async ({ page, request }) => {
      // GIVEN: Create an evalset, run it, then run again
      const response = await request.post(`/api/agents/${TEST_PROJECT}/evaluations`, {
        data: {
          name: 'Previous Results Evalset',
          description: 'For viewing previous results',
          testCases: [{ input: 'Hello', expectedOutput: 'hi' }],
        },
      });
      const evalset = await response.json();

      await page.goto(`/${TEST_PROJECT}/evaluations/${evalset.id}`);

      // Run first evaluation
      await page.locator('[data-testid="run-evaluation-btn"]').click();
      await expect(page.locator('[data-testid="evaluation-results"]')).toBeVisible({ timeout: 60000 });

      // Run second evaluation
      await page.locator('[data-testid="run-evaluation-btn"]').click();
      await expect(page.locator('[data-testid="evaluation-results"]')).toBeVisible({ timeout: 60000 });

      // WHEN: Click on a previous run in history
      const historyItems = page.locator('[data-testid="history-item"]');
      await expect(historyItems).toHaveCount(2);
      await historyItems.last().click(); // Click the older run

      // THEN: Results from that run should be displayed
      await expect(page.locator('[data-testid="evaluation-results"]')).toBeVisible();
    });
  });
});
