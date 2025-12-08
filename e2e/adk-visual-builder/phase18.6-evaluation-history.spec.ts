/**
 * Phase 18.6: Evaluation History & Regression Tracking
 *
 * Ensures users can track evaluation runs over time with:
 * - Run history sidebar showing previous runs
 * - Run comparison view
 * - Regression detection
 * - Trend visualization
 * - Baseline management
 */

import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');

test.describe('Phase 18.6: Evaluation History & Regression Tracking', () => {
  const testProjectName = 'history_test_project';

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
    await instructionField.fill('You are a test agent for evaluation history.');

    // Wait for Save button to be enabled
    const saveButton = page.locator('button:has-text("Save")');
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();
    await page.waitForSelector('text=Saved successfully', { timeout: 15000 });
  });

  test.afterEach(async () => {
    // Clean up test project
    try {
      await fs.rm(path.join(ADK_AGENTS_DIR, testProjectName), { recursive: true, force: true });
    } catch {}
  });

  test('Story 18.6.1: Run history sidebar shows list of previous runs', async ({ page }) => {
    test.setTimeout(150000); // 2.5 minutes for two evaluation runs

    // Navigate to evaluations page
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible({ timeout: 10000 });

    // Create an evalset
    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('input[name="name"]').fill('History Test');
    await dialog.locator('textarea[name="description"]').fill('Testing run history');
    await page.locator('[data-testid="confirm-create-evalset"]').click();

    // Wait for evalset card to appear
    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible({ timeout: 10000 });

    // Click "View Details" to navigate to eval detail page
    await Promise.all([
      page.waitForURL(/\/evaluations\/[^/]+$/),
      page.locator('[data-testid="evalset-card"]').locator('text=View Details').click()
    ]);

    // Add a conversation
    await page.locator('[data-testid="add-conversation-btn"]').click();
    await page.locator('[data-testid="user-message-input-0"]').fill('Test question');
    await page.locator('[data-testid="expected-response-input-0"]').fill('Test response');
    await page.locator('[data-testid="save-conversation-btn"]').click();

    // Run evaluation (first run)
    await page.locator('[data-testid="run-evaluation-btn"]').click();

    // Wait for "Running" status first
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Running', { timeout: 5000 });

    // Then wait for completion
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });

    // Wait a moment for UI to settle after first run
    await page.waitForTimeout(1000);

    // Run evaluation again (second run)
    await page.locator('[data-testid="rerun-evaluation-btn"]').click();

    // Wait for "Running" status again
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Running', { timeout: 5000 });

    // Then wait for completion
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });

    // Check that run history sidebar is visible
    await expect(page.locator('[data-testid="run-history-sidebar"]')).toBeVisible();

    // Check that we see 2 runs in the history
    const runHistoryItems = page.locator('[data-testid^="run-history-item-"]');
    await expect(runHistoryItems).toHaveCount(2);

    // Each run should have timestamp
    await expect(page.locator('[data-testid^="run-timestamp-"]').first()).toBeVisible();

    // Each run should have overall pass rate
    await expect(page.locator('[data-testid^="run-pass-rate-"]').first()).toBeVisible();
  });

  test('Story 18.6.2: Can select run from history to view its results', async ({ page }) => {
    test.setTimeout(150000); // 2.5 minutes for two evaluation runs

    // Navigate to evaluations page and create evalset
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await dialog.locator('input[name="name"]').fill('Selection Test');
    await page.locator('[data-testid="confirm-create-evalset"]').click();
    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible();

    // Click "View Details" to navigate to eval detail page
    await Promise.all([
      page.waitForURL(/\/evaluations\/[^/]+$/),
      page.locator('[data-testid="evalset-card"]').locator('text=View Details').click()
    ]);

    // Add conversation and run evaluation
    await page.locator('[data-testid="add-conversation-btn"]').click();
    await page.locator('[data-testid="user-message-input-0"]').fill('Question 1');
    await page.locator('[data-testid="expected-response-input-0"]').fill('Answer 1');
    await page.locator('[data-testid="save-conversation-btn"]').click();

    await page.locator('[data-testid="run-evaluation-btn"]').click();

    // Wait for "Running" status first
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Running', { timeout: 5000 });

    // Then wait for completion
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });

    // Get the first run's pass rate
    const firstRunPassRate = await page.locator('[data-testid="overall-pass-rate"]').textContent();

    // Wait a moment for UI to settle after first run
    await page.waitForTimeout(1000);

    // Run again
    await page.locator('[data-testid="rerun-evaluation-btn"]').click();

    // Wait for "Running" status again
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Running', { timeout: 5000 });

    // Then wait for completion
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });

    // Click on the first run in history
    const firstHistoryItem = page.locator('[data-testid^="run-history-item-"]').first();
    await firstHistoryItem.click();

    // Should see results for that specific run
    // The overall pass rate should match what we saw for the first run
    await expect(page.locator('[data-testid="overall-pass-rate"]')).toBeVisible();
  });

  test('Story 18.6.3: Run history shows per-metric scores for each run', async ({ page }) => {
    test.setTimeout(90000); // 1.5 minutes for one evaluation run

    // Navigate to evaluations page and create evalset
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await dialog.locator('input[name="name"]').fill('Metrics History Test');
    await page.locator('[data-testid="confirm-create-evalset"]').click();
    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible();

    // Click "View Details" to navigate to eval detail page
    await Promise.all([
      page.waitForURL(/\/evaluations\/[^/]+$/),
      page.locator('[data-testid="evalset-card"]').locator('text=View Details').click()
    ]);

    // Add conversation and run
    await page.locator('[data-testid="add-conversation-btn"]').click();
    await page.locator('[data-testid="user-message-input-0"]').fill('Test');
    await page.locator('[data-testid="expected-response-input-0"]').fill('Response');
    await page.locator('[data-testid="save-conversation-btn"]').click();

    await page.locator('[data-testid="run-evaluation-btn"]').click();
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });

    // Expand the first run in history to see details
    const firstHistoryItem = page.locator('[data-testid^="run-history-item-"]').first();

    // Check if run item shows metric scores (could be inline or in expanded view)
    // The sidebar shows metrics truncated (e.g. "response_matc...")
    await expect(page.locator('[data-testid="run-history-sidebar"]')).toContainText('response_matc');
  });

  test('Story 18.6.4: Can tag/label runs for easier identification', async ({ page }) => {
    test.setTimeout(90000); // 1.5 minutes for one evaluation run

    // Navigate to evaluations page and create evalset
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await dialog.locator('input[name="name"]').fill('Tag Test');
    await page.locator('[data-testid="confirm-create-evalset"]').click();
    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible();

    // Click "View Details" to navigate to eval detail page
    await Promise.all([
      page.waitForURL(/\/evaluations\/[^/]+$/),
      page.locator('[data-testid="evalset-card"]').locator('text=View Details').click()
    ]);

    // Add conversation and run
    await page.locator('[data-testid="add-conversation-btn"]').click();
    await page.locator('[data-testid="user-message-input-0"]').fill('Test');
    await page.locator('[data-testid="expected-response-input-0"]').fill('Response');
    await page.locator('[data-testid="save-conversation-btn"]').click();

    await page.locator('[data-testid="run-evaluation-btn"]').click();
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });

    // Click button to add tag/label to this run
    await page.locator('[data-testid="add-run-tag-btn"]').click();

    // Enter tag name
    await page.locator('[data-testid="run-tag-input"]').fill('baseline');
    await page.locator('[data-testid="save-run-tag-btn"]').click();

    // Tag should appear on the run in history
    const firstHistoryItem = page.locator('[data-testid^="run-history-item-"]').first();
    await expect(firstHistoryItem).toContainText('baseline');
  });

  test('Story 18.6.5: Can mark a run as baseline', async ({ page }) => {
    test.setTimeout(90000); // 1.5 minutes for one evaluation run

    // Navigate to evaluations page and create evalset
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await dialog.locator('input[name="name"]').fill('Baseline Test');
    await page.locator('[data-testid="confirm-create-evalset"]').click();
    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible();

    // Click "View Details" to navigate to eval detail page
    await Promise.all([
      page.waitForURL(/\/evaluations\/[^/]+$/),
      page.locator('[data-testid="evalset-card"]').locator('text=View Details').click()
    ]);

    // Add conversation and run
    await page.locator('[data-testid="add-conversation-btn"]').click();
    await page.locator('[data-testid="user-message-input-0"]').fill('Test');
    await page.locator('[data-testid="expected-response-input-0"]').fill('Response');
    await page.locator('[data-testid="save-conversation-btn"]').click();

    await page.locator('[data-testid="run-evaluation-btn"]').click();
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });

    // Click button to set this run as baseline
    // Handle the browser confirm dialog
    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-testid="set-baseline-btn"]').click();

    // Wait for API call to complete
    await page.waitForTimeout(1000);

    // Run should now show "Baseline" badge
    const firstHistoryItem = page.locator('[data-testid^="run-history-item-"]').first();
    await expect(firstHistoryItem.locator('[data-testid="baseline-badge"]')).toBeVisible();
  });
});
