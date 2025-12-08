/**
 * Phase 18.7: Prompt Optimization Workflow
 *
 * Custom workflow built on top of ADK evaluation to enable iterative prompt engineering.
 * Enables users to:
 * - Compare multiple evaluation runs side-by-side
 * - Detect regressions (tests that passed before but fail now)
 * - View prompt diffs between runs
 * - Quickly edit prompts and re-run evaluations
 *
 * Note: This is NOT a core ADK feature - it's a value-add workflow we're building
 * on top of ADK's evaluation primitives.
 */

import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');

test.describe('Phase 18.7: Prompt Optimization Workflow', () => {
  const testProjectName = 'prompt_opt_test_project';

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

    // Clear and fill instruction field
    const instructionField = page.locator('textarea[data-testid="agent-instruction"]');
    await instructionField.clear();
    await instructionField.fill('You are a helpful assistant. Answer questions clearly.');

    // Save the agent
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

  test('Story 18.7.1: Run history items have checkboxes for multi-select', async ({ page }) => {
    test.setTimeout(150000); // 2.5 minutes for two evaluation runs

    // Navigate to evaluations page
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    // Create evalset
    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await dialog.locator('input[name="name"]').fill('Comparison Test');
    await page.locator('[data-testid="confirm-create-evalset"]').click();
    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible();

    // Navigate to eval detail page
    await Promise.all([
      page.waitForURL(/\/evaluations\/[^/]+$/),
      page.locator('[data-testid="evalset-card"]').locator('text=View Details').click()
    ]);

    // Add conversation
    await page.locator('[data-testid="add-conversation-btn"]').click();
    await page.locator('[data-testid="user-message-input-0"]').fill('What is 2+2?');
    await page.locator('[data-testid="expected-response-input-0"]').fill('4');
    await page.locator('[data-testid="save-conversation-btn"]').click();

    // Run evaluation (first run)
    await page.locator('[data-testid="run-evaluation-btn"]').click();
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Running', { timeout: 5000 });
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });

    await page.waitForTimeout(1000);

    // Run evaluation again (second run)
    await page.locator('[data-testid="rerun-evaluation-btn"]').click();
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Running', { timeout: 5000 });
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });

    // Check that run history items have checkboxes
    const runHistoryItems = page.locator('[data-testid^="run-history-item-"]');
    await expect(runHistoryItems).toHaveCount(2);

    // Each run should have a checkbox
    const firstRunCheckbox = page.locator('[data-testid="run-checkbox-0"]');
    await expect(firstRunCheckbox).toBeVisible();

    const secondRunCheckbox = page.locator('[data-testid="run-checkbox-1"]');
    await expect(secondRunCheckbox).toBeVisible();
  });

  test('Story 18.7.2: Compare button appears when 2+ runs selected', async ({ page }) => {
    test.setTimeout(150000); // 2.5 minutes

    // Navigate to evaluations page and create evalset with 2 runs
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await dialog.locator('input[name="name"]').fill('Compare Test');
    await page.locator('[data-testid="confirm-create-evalset"]').click();
    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/evaluations\/[^/]+$/),
      page.locator('[data-testid="evalset-card"]').locator('text=View Details').click()
    ]);

    // Add conversation and run twice
    await page.locator('[data-testid="add-conversation-btn"]').click();
    await page.locator('[data-testid="user-message-input-0"]').fill('Test');
    await page.locator('[data-testid="expected-response-input-0"]').fill('Response');
    await page.locator('[data-testid="save-conversation-btn"]').click();

    // Run 1
    await page.locator('[data-testid="run-evaluation-btn"]').click();
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Running', { timeout: 5000 });
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });
    await page.waitForTimeout(1000);

    // Run 2
    await page.locator('[data-testid="rerun-evaluation-btn"]').click();
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Running', { timeout: 5000 });
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });

    // Compare button should NOT be visible initially (no runs selected)
    await expect(page.locator('[data-testid="compare-runs-btn"]')).not.toBeVisible();

    // Select first run
    await page.locator('[data-testid="run-checkbox-0"]').click();

    // Compare button still not visible (only 1 selected)
    await expect(page.locator('[data-testid="compare-runs-btn"]')).not.toBeVisible();

    // Select second run
    await page.locator('[data-testid="run-checkbox-1"]').click();

    // NOW compare button should be visible (2 runs selected)
    await expect(page.locator('[data-testid="compare-runs-btn"]')).toBeVisible();
  });

  test('Story 18.7.3: Comparison view shows metrics for selected runs', async ({ page }) => {
    test.setTimeout(150000);

    // Set up evalset with 2 runs
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await dialog.locator('input[name="name"]').fill('Metrics Compare');
    await page.locator('[data-testid="confirm-create-evalset"]').click();
    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/evaluations\/[^/]+$/),
      page.locator('[data-testid="evalset-card"]').locator('text=View Details').click()
    ]);

    await page.locator('[data-testid="add-conversation-btn"]').click();
    await page.locator('[data-testid="user-message-input-0"]').fill('Test');
    await page.locator('[data-testid="expected-response-input-0"]').fill('Response');
    await page.locator('[data-testid="save-conversation-btn"]').click();

    // Run twice
    await page.locator('[data-testid="run-evaluation-btn"]').click();
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });
    await page.waitForTimeout(1000);

    await page.locator('[data-testid="rerun-evaluation-btn"]').click();
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });

    // Select both runs and compare
    await page.locator('[data-testid="run-checkbox-0"]').click();
    await page.locator('[data-testid="run-checkbox-1"]').click();
    await page.locator('[data-testid="compare-runs-btn"]').click();

    // Should see comparison view
    await expect(page.locator('[data-testid="comparison-view"]')).toBeVisible();

    // Should see metrics comparison table
    await expect(page.locator('[data-testid="metrics-comparison-table"]')).toBeVisible();

    // Table should have columns for each run
    await expect(page.locator('[data-testid="comparison-run-column-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="comparison-run-column-1"]')).toBeVisible();

    // Should show metric rows (at least response_match_score)
    await expect(page.locator('[data-testid="metric-row-response_match_score"]')).toBeVisible();
  });

  test('Story 18.7.4: Comparison view shows delta indicators', async ({ page }) => {
    test.setTimeout(150000);

    // This test would verify that we show ↑ ↓ → indicators for metric changes
    // For now, just check that delta cells exist

    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await dialog.locator('input[name="name"]').fill('Delta Test');
    await page.locator('[data-testid="confirm-create-evalset"]').click();
    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/evaluations\/[^/]+$/),
      page.locator('[data-testid="evalset-card"]').locator('text=View Details').click()
    ]);

    await page.locator('[data-testid="add-conversation-btn"]').click();
    await page.locator('[data-testid="user-message-input-0"]').fill('Test');
    await page.locator('[data-testid="expected-response-input-0"]').fill('Response');
    await page.locator('[data-testid="save-conversation-btn"]').click();

    // Run twice
    await page.locator('[data-testid="run-evaluation-btn"]').click();
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });
    await page.waitForTimeout(1000);

    await page.locator('[data-testid="rerun-evaluation-btn"]').click();
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });

    // Select and compare
    await page.locator('[data-testid="run-checkbox-0"]').click();
    await page.locator('[data-testid="run-checkbox-1"]').click();
    await page.locator('[data-testid="compare-runs-btn"]').click();

    // Check for delta/change indicators
    await expect(page.locator('[data-testid="comparison-view"]')).toBeVisible();

    // Delta cells should exist (showing ↑ improved, ↓ regressed, → same)
    const deltaCells = page.locator('[data-testid^="delta-cell-"]');
    await expect(deltaCells.first()).toBeVisible();
  });

  test('Story 18.7.5: Close comparison view returns to results', async ({ page }) => {
    test.setTimeout(150000);

    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await dialog.locator('input[name="name"]').fill('Close Test');
    await page.locator('[data-testid="confirm-create-evalset"]').click();
    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/evaluations\/[^/]+$/),
      page.locator('[data-testid="evalset-card"]').locator('text=View Details').click()
    ]);

    await page.locator('[data-testid="add-conversation-btn"]').click();
    await page.locator('[data-testid="user-message-input-0"]').fill('Test');
    await page.locator('[data-testid="expected-response-input-0"]').fill('Response');
    await page.locator('[data-testid="save-conversation-btn"]').click();

    // Run twice
    await page.locator('[data-testid="run-evaluation-btn"]').click();
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });
    await page.waitForTimeout(1000);

    await page.locator('[data-testid="rerun-evaluation-btn"]').click();
    await expect(page.locator('[data-testid="run-status"]')).toContainText('Completed', { timeout: 60000 });

    // Open comparison view
    await page.locator('[data-testid="run-checkbox-0"]').click();
    await page.locator('[data-testid="run-checkbox-1"]').click();
    await page.locator('[data-testid="compare-runs-btn"]').click();
    await expect(page.locator('[data-testid="comparison-view"]')).toBeVisible();

    // Close comparison view
    await page.locator('[data-testid="close-comparison-btn"]').click();

    // Should return to normal results view
    await expect(page.locator('[data-testid="comparison-view"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="results-dashboard"]')).toBeVisible();
  });
});
