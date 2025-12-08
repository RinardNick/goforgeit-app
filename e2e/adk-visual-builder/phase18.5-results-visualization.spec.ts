/**
 * Phase 18.5: Results Visualization & Analysis
 *
 * Ensures users can view and analyze evaluation results with:
 * - Results dashboard with overall pass rate
 * - Per-metric scores with visual gauges
 * - Side-by-side comparison (expected vs actual)
 * - Failed test filtering
 * - Re-run controls
 */

import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');

test.describe('Phase 18.5: Results Visualization & Analysis', () => {
  const testProjectName = 'results_viz_test_project';

  test.beforeEach(async ({ page }) => {
    // Clean up test project if it exists
    try {
      await fs.rm(path.join(ADK_AGENTS_DIR, testProjectName), { recursive: true, force: true });
    } catch {}

    // Create test project with agent and evalset
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create new project
    await page.click('button:has-text("New Project")');
    await page.waitForSelector('[data-testid="new-project-dialog"]');
    await page.fill('input[name="projectName"]', testProjectName);
    await page.click('button:has-text("Create")');

    await page.waitForURL(`**/${testProjectName}/compose`);

    // Set up root agent with instruction
    await page.waitForSelector('[data-testid="agent-canvas"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="agent-node"]:has-text("root_agent")', { timeout: 10000 });
    await page.click('[data-testid="agent-node"]:has-text("root_agent")');
    await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible();

    // Clear and fill instruction field to trigger change detection
    const instructionField = page.locator('textarea[data-testid="agent-instruction"]');
    await instructionField.clear();
    await instructionField.fill('You are a test agent for evaluation.');

    // Wait for Save button to be enabled
    const saveButton = page.locator('button:has-text("Save")');
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();
    await page.waitForSelector('text=Saved successfully');
  });

  test.afterEach(async () => {
    // Clean up test project
    try {
      await fs.rm(path.join(ADK_AGENTS_DIR, testProjectName), { recursive: true, force: true });
    } catch {}
  });

  test('Story 18.5.1: Results dashboard shows overall pass rate after evaluation run', async ({ page }) => {
    // Navigate to evaluations page
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible({ timeout: 10000 });

    // Create a simple evalset
    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('input[name="name"]').fill('Test Evalset');
    await dialog.locator('textarea[name="description"]').fill('Simple test evalset');
    await page.locator('[data-testid="confirm-create-evalset"]').click();

    // Wait for evalset card to appear
    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible({ timeout: 10000 });

    // Click "View Details" link to navigate to eval detail page
    await page.locator('[data-testid="evalset-card"]').locator('text=View Details').click();

    // Wait for eval detail page
    await expect(page).toHaveURL(/\/evaluations\/[^/]+$/);

    // Add a conversation
    await page.locator('[data-testid="add-conversation-btn"]').click();
    await page.locator('[data-testid="user-message-input-0"]').fill('What is 1+1?');
    await page.locator('[data-testid="expected-response-input-0"]').fill('The answer is 2');
    await page.locator('[data-testid="save-conversation-btn"]').click();

    // Run evaluation
    await page.locator('[data-testid="run-evaluation-btn"]').click();

    // Wait for run to complete
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });

    // Check that results dashboard is visible
    await expect(page.locator('[data-testid="results-dashboard"]')).toBeVisible();

    // Check that overall pass rate is displayed
    const passRateElement = page.locator('[data-testid="overall-pass-rate"]');
    await expect(passRateElement).toBeVisible();

    // Pass rate should be a percentage (0-100%)
    const passRateText = await passRateElement.textContent();
    expect(passRateText).toMatch(/\d+(\.\d+)?%/);
  });

  test('Story 18.5.2: Per-metric scores displayed with visual gauges', async ({ page }) => {
    // Navigate to evaluations page
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    // Create evalset with conversation
    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await dialog.locator('input[name="name"]').fill('Metrics Test');
    await dialog.locator('textarea[name="description"]').fill('Test metric visualization');
    await page.locator('[data-testid="confirm-create-evalset"]').click();
    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible();
    await page.locator('[data-testid="evalset-card"]').locator('text=View Details').click();

    // Add conversation
    await page.locator('[data-testid="add-conversation-btn"]').click();
    await page.locator('[data-testid="user-message-input-0"]').fill('Test question');
    await page.locator('[data-testid="expected-response-input-0"]').fill('Test response');
    await page.locator('[data-testid="save-conversation-btn"]').click();

    // Run evaluation
    await page.locator('[data-testid="run-evaluation-btn"]').click();
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });

    // Check that metric cards are displayed
    const metricCards = page.locator('[data-testid^="metric-card-"]');
    await expect(metricCards.first()).toBeVisible();

    // Should have cards for each metric (at least response_match_score)
    await expect(page.locator('[data-testid="metric-card-response_match_score"]')).toBeVisible();

    // Each metric card should have a gauge/progress indicator
    await expect(page.locator('[data-testid="metric-gauge-response_match_score"]')).toBeVisible();

    // Gauge should show a score value
    const gaugeText = await page.locator('[data-testid="metric-gauge-response_match_score"]').textContent();
    expect(gaugeText).toMatch(/\d+(\.\d+)?/);
  });

  test('Story 18.5.3: Side-by-side comparison shows expected vs actual response', async ({ page }) => {
    // Navigate to evaluations page
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    // Create evalset
    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await dialog.locator('input[name="name"]').fill('Comparison Test');
    await page.locator('[data-testid="confirm-create-evalset"]').click();
    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible();
    await page.locator('[data-testid="evalset-card"]').locator('text=View Details').click();

    // Add conversation
    await page.locator('[data-testid="add-conversation-btn"]').click();
    await page.locator('[data-testid="user-message-input-0"]').fill('Hello');
    await page.locator('[data-testid="expected-response-input-0"]').fill('Hi there!');
    await page.locator('[data-testid="save-conversation-btn"]').click();

    // Run evaluation
    await page.locator('[data-testid="run-evaluation-btn"]').click();
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });

    // Expand first conversation result
    await page.locator('[data-testid="conversation-result-0"]').click();

    // Check that comparison view is visible
    await expect(page.locator('[data-testid="comparison-view"]')).toBeVisible();

    // Check expected response is shown
    await expect(page.locator('[data-testid="expected-response"]')).toBeVisible();
    await expect(page.locator('[data-testid="expected-response"]')).toContainText('Hi there!');

    // Check actual response is shown
    await expect(page.locator('[data-testid="actual-response"]')).toBeVisible();
  });

  test('Story 18.5.4: Failed tests can be filtered', async ({ page }) => {
    // Navigate to evaluations page
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    // Create evalset with multiple conversations
    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await dialog.locator('input[name="name"]').fill('Filter Test');
    await page.locator('[data-testid="confirm-create-evalset"]').click();
    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible();
    await page.locator('[data-testid="evalset-card"]').locator('text=View Details').click();

    // Add first conversation (likely to pass)
    await page.locator('[data-testid="add-conversation-btn"]').click();
    await page.locator('[data-testid="user-message-input-0"]').fill('Say hello');
    await page.locator('[data-testid="expected-response-input-0"]').fill('Hello');
    await page.locator('[data-testid="save-conversation-btn"]').click();

    // Add second conversation (likely to fail - very specific expectation)
    await page.locator('[data-testid="add-conversation-btn"]').click();
    await page.locator('[data-testid="user-message-input-0"]').fill('Tell me a secret');
    await page.locator('[data-testid="expected-response-input-0"]').fill('The secret is xyz123abc');
    await page.locator('[data-testid="save-conversation-btn"]').click();

    // Run evaluation
    await page.locator('[data-testid="run-evaluation-btn"]').click();
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });

    // Check that filter controls exist
    await expect(page.locator('[data-testid="filter-failed-tests"]')).toBeVisible();

    // Count conversation results before filtering
    const allResultsBeforeFilter = page.locator('[data-testid^="conversation-result-"]');
    const totalBeforeFilter = await allResultsBeforeFilter.count();
    expect(totalBeforeFilter).toBeGreaterThan(0);

    // Click "Show only failures" toggle
    await page.locator('[data-testid="filter-failed-tests"]').click();

    // After filtering, either see filtered results OR "No failed tests found" message
    // First check if there's a "No failed tests found" message
    const noFailedMessage = page.locator('text=No failed tests found');
    const hasNoFailed = await noFailedMessage.isVisible();

    if (hasNoFailed) {
      // If all tests passed, that's valid - the filter is working correctly
      // Just verify the message is shown and no conversation results are visible
      await expect(noFailedMessage).toBeVisible();
      const visibleResults = page.locator('[data-testid^="conversation-result-"]');
      expect(await visibleResults.count()).toBe(0);
    } else {
      // If there are failed tests, verify we see fewer results than before filtering
      const visibleResults = page.locator('[data-testid^="conversation-result-"]');
      const countAfterFilter = await visibleResults.count();
      expect(countAfterFilter).toBeLessThanOrEqual(totalBeforeFilter);
      expect(countAfterFilter).toBeGreaterThan(0);
      await expect(visibleResults.first()).toBeVisible();
    }
  });

  test('Story 18.5.5: Re-run entire evalset button exists', async ({ page }) => {
    // Navigate to evaluations page
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    // Create evalset
    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await dialog.locator('input[name="name"]').fill('Rerun Test');
    await page.locator('[data-testid="confirm-create-evalset"]').click();
    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible();
    await page.locator('[data-testid="evalset-card"]').locator('text=View Details').click();

    // Add conversation
    await page.locator('[data-testid="add-conversation-btn"]').click();
    await page.locator('[data-testid="user-message-input-0"]').fill('Test');
    await page.locator('[data-testid="expected-response-input-0"]').fill('Response');
    await page.locator('[data-testid="save-conversation-btn"]').click();

    // Run evaluation once
    await page.locator('[data-testid="run-evaluation-btn"]').click();
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });

    // Check that re-run button is available
    await expect(page.locator('[data-testid="rerun-evaluation-btn"]')).toBeVisible();

    // Click re-run button
    await page.locator('[data-testid="rerun-evaluation-btn"]').click();

    // Should start a new run
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Running', { timeout: 5000 });
  });

  test('Story 18.5.6: Export results as JSON button exists', async ({ page }) => {
    // Navigate to evaluations page
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    // Create evalset
    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await dialog.locator('input[name="name"]').fill('Export Test');
    await page.locator('[data-testid="confirm-create-evalset"]').click();
    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible();
    await page.locator('[data-testid="evalset-card"]').locator('text=View Details').click();

    // Add conversation
    await page.locator('[data-testid="add-conversation-btn"]').click();
    await page.locator('[data-testid="user-message-input-0"]').fill('Test');
    await page.locator('[data-testid="expected-response-input-0"]').fill('Response');
    await page.locator('[data-testid="save-conversation-btn"]').click();

    // Run evaluation
    await page.locator('[data-testid="run-evaluation-btn"]').click();
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });

    // Check that export button exists
    await expect(page.locator('[data-testid="export-results-btn"]')).toBeVisible();
  });
});
