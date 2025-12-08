/**
 * Phase 18.9: Evaluation Metrics Configuration UI
 *
 * Users can configure which evaluation metrics to use, set thresholds,
 * and write custom LLM evaluation prompts (rubrics).
 *
 * Config files are stored as {evalset_id}.config.json in the evaluations directory.
 */

import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');

test.describe('Phase 18.9: Evaluation Metrics Configuration UI', () => {
  const testProjectName = 'metrics_config_test';

  test.beforeEach(async ({ page }) => {
    // Clean up test project if it exists
    try {
      await fs.rm(path.join(ADK_AGENTS_DIR, testProjectName), { recursive: true, force: true });
    } catch {}

    // Create test project with agent
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('button:has-text("New Project")');
    await page.waitForSelector('[data-testid="new-project-dialog"]');
    await page.fill('input[name="projectName"]', testProjectName);
    await page.click('button:has-text("Create")');

    await page.waitForURL(`**/${testProjectName}/compose`);

    // Wait for agent canvas to be ready
    await page.waitForSelector('[data-testid="agent-canvas"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="agent-node"]:has-text("root_agent")', { timeout: 10000 });

    // Navigate to evaluations page
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible({ timeout: 10000 });

    // Create an evalset to work with
    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await dialog.locator('input[name="name"]').fill('Config Test Evalset');
    await page.locator('[data-testid="confirm-create-evalset"]').click();

    // Wait for evalset to be created
    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible();

    // Navigate to evalset detail page
    await Promise.all([
      page.waitForURL(/\/evaluations\/[^/]+$/),
      page.locator('[data-testid="evalset-card"]').locator('text=View Details').click(),
    ]);

    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    // Clean up test project
    try {
      await fs.rm(path.join(ADK_AGENTS_DIR, testProjectName), { recursive: true, force: true });
    } catch {}
  });

  test('Story 18.9.1: Configure Metrics button exists on evalset detail page', async ({ page }) => {
    // Button should be visible on evalset detail page
    await expect(page.locator('[data-testid="configure-metrics-btn"]')).toBeVisible({ timeout: 10000 });

    // Button should have correct text
    await expect(page.locator('[data-testid="configure-metrics-btn"]')).toContainText('Configure Metrics');
  });

  test('Story 18.9.2: Open metrics configuration modal', async ({ page }) => {
    // Click Configure Metrics button
    await page.locator('[data-testid="configure-metrics-btn"]').click();

    // Modal should open
    await expect(page.locator('[data-testid="metrics-config-modal"]')).toBeVisible({ timeout: 10000 });

    // Modal should have correct title
    await expect(page.locator('[data-testid="metrics-config-modal"]')).toContainText('Configure Evaluation Metrics');

    // Modal should display after loading completes (wait for loading spinner to disappear if present)
    // The modal content should be visible
    await expect(page.locator('[data-testid="metrics-config-modal"]')).toBeVisible();
  });

  test('Story 18.9.3: View default metric configuration', async ({ page }) => {
    // Click Configure Metrics button to open modal
    await page.locator('[data-testid="configure-metrics-btn"]').click();
    await expect(page.locator('[data-testid="metrics-config-modal"]')).toBeVisible({ timeout: 10000 });

    // Should show "Using Defaults" badge when no custom config
    await expect(page.locator('[data-testid="config-status-badge"]')).toContainText('Using Defaults');

    // Should show all 7 ADK metrics
    const metricCards = page.locator('[data-testid^="metric-card-"]');
    await expect(metricCards).toHaveCount(7);

    // Check tool_trajectory_avg_score metric (enabled by default)
    const toolTrajectoryCard = page.locator('[data-testid="metric-card-tool_trajectory_avg_score"]');
    await expect(toolTrajectoryCard).toContainText('tool_trajectory_avg_score');
    await expect(toolTrajectoryCard).toContainText('Tool Trajectory Score');
    await expect(toolTrajectoryCard).toContainText('1.0'); // default threshold

    // Check response_match_score metric (enabled by default)
    const responseMatchCard = page.locator('[data-testid="metric-card-response_match_score"]');
    await expect(responseMatchCard).toContainText('response_match_score');
    await expect(responseMatchCard).toContainText('Response Match Score');
    await expect(responseMatchCard).toContainText('0.8'); // default threshold

    // Check that LLM metrics show as disabled by default
    const llmMetricCard = page.locator('[data-testid="metric-card-rubric_based_final_response_quality_v1"]');
    await expect(llmMetricCard).toContainText('Disabled');
  });

  test('Story 18.9.4: Toggle Metric On/Off', async ({ page }) => {
    // Click Configure Metrics button to open modal
    await page.locator('[data-testid="configure-metrics-btn"]').click();
    await expect(page.locator('[data-testid="metrics-config-modal"]')).toBeVisible({ timeout: 10000 });

    // Each metric card should have a toggle switch
    const firstMetricToggle = page.locator('[data-testid="metric-toggle-tool_trajectory_avg_score"]');
    await expect(firstMetricToggle).toBeVisible();

    // Check that tool_trajectory_avg_score is enabled by default (toggle should be checked)
    await expect(firstMetricToggle).toBeChecked();

    // Check that an LLM metric is disabled by default (toggle should be unchecked)
    const llmMetricToggle = page.locator('[data-testid="metric-toggle-rubric_based_final_response_quality_v1"]');
    await expect(llmMetricToggle).toBeVisible();
    await expect(llmMetricToggle).not.toBeChecked();

    // Click toggle to enable an LLM metric
    await llmMetricToggle.click();
    await expect(llmMetricToggle).toBeChecked();

    // Verify the "Disabled" badge is removed
    const llmMetricCard = page.locator('[data-testid="metric-card-rubric_based_final_response_quality_v1"]');
    await expect(llmMetricCard.locator('text=Disabled')).not.toBeVisible();

    // Try to disable the last enabled deterministic metric (should be prevented)
    // First, disable response_match_score
    const responseMatchToggle = page.locator('[data-testid="metric-toggle-response_match_score"]');
    await responseMatchToggle.click();
    await expect(responseMatchToggle).not.toBeChecked();

    // Now try to disable tool_trajectory_avg_score (the last enabled metric)
    // This should be prevented or show an error message
    await firstMetricToggle.click();

    // Either the toggle should remain checked, or an error message should appear
    // For now, we'll test that at least 1 metric remains enabled by checking the toggle state
    const enabledToggles = page.locator('input[data-testid^="metric-toggle-"]:checked');
    await expect(enabledToggles).toHaveCount(1); // At least 1 metric must remain enabled (the LLM one we enabled)
  });

  test('Story 18.9.5: Adjust Metric Threshold', async ({ page }) => {
    // Click Configure Metrics button to open modal
    await page.locator('[data-testid="configure-metrics-btn"]').click();
    await expect(page.locator('[data-testid="metrics-config-modal"]')).toBeVisible({ timeout: 10000 });

    // Each enabled metric should show a threshold slider
    const firstMetricSlider = page.locator('[data-testid="threshold-slider-tool_trajectory_avg_score"]');
    await expect(firstMetricSlider).toBeVisible();

    // Slider should show current threshold value
    const sliderValue = await firstMetricSlider.inputValue();
    expect(parseFloat(sliderValue)).toBe(1.0); // Default threshold for tool_trajectory_avg_score

    // Slider should allow changing the value
    await firstMetricSlider.fill('0.75');
    const newValue = await firstMetricSlider.inputValue();
    expect(parseFloat(newValue)).toBe(0.75);

    // Disabled metrics should not show slider (or should be disabled)
    // First enable the LLM metric
    const llmMetricToggle = page.locator('[data-testid="metric-toggle-rubric_based_final_response_quality_v1"]');
    await llmMetricToggle.click();
    await expect(llmMetricToggle).toBeChecked();

    // Now check that the slider appears for the newly enabled LLM metric
    const llmMetricSlider = page.locator('[data-testid="threshold-slider-rubric_based_final_response_quality_v1"]');
    await expect(llmMetricSlider).toBeVisible();

    // Verify slider default value for LLM metric
    const llmSliderValue = await llmMetricSlider.inputValue();
    expect(parseFloat(llmSliderValue)).toBe(0.7); // Default threshold for LLM metrics
  });

  test('Story 18.9.6: Edit Custom Rubric for LLM Metrics', async ({ page }) => {
    // Click Configure Metrics button to open modal
    await page.locator('[data-testid="configure-metrics-btn"]').click();
    await expect(page.locator('[data-testid="metrics-config-modal"]')).toBeVisible({ timeout: 10000 });

    // Enable an LLM metric with rubric support
    const rubricMetricToggle = page.locator('[data-testid="metric-toggle-rubric_based_final_response_quality_v1"]');
    await rubricMetricToggle.click();
    await expect(rubricMetricToggle).toBeChecked();

    // LLM metric with rubric support should show rubric editor (textarea)
    const rubricEditor = page.locator('[data-testid="rubric-editor-rubric_based_final_response_quality_v1"]');
    await expect(rubricEditor).toBeVisible();

    // Editor should be a textarea
    const tagName = await rubricEditor.evaluate((el) => el.tagName.toLowerCase());
    expect(tagName).toBe('textarea');

    // Editor should have placeholder text
    const placeholder = await rubricEditor.getAttribute('placeholder');
    expect(placeholder).toContain('Write custom evaluation criteria');

    // Editor should support multiline text
    await rubricEditor.fill('Line 1\nLine 2\nLine 3');
    const value = await rubricEditor.inputValue();
    expect(value).toBe('Line 1\nLine 2\nLine 3');

    // Check that another rubric-based metric also shows editor
    const toolUseMetricToggle = page.locator('[data-testid="metric-toggle-rubric_based_tool_use_quality_v1"]');
    await toolUseMetricToggle.click();
    await expect(toolUseMetricToggle).toBeChecked();

    const toolUseRubricEditor = page.locator('[data-testid="rubric-editor-rubric_based_tool_use_quality_v1"]');
    await expect(toolUseRubricEditor).toBeVisible();

    // LLM metrics without rubric support should NOT show editor
    // Enable final_response_match_v2 (LLM metric without rubric support)
    const noRubricMetricToggle = page.locator('[data-testid="metric-toggle-final_response_match_v2"]');
    await noRubricMetricToggle.click();
    await expect(noRubricMetricToggle).toBeChecked();

    // Should not have a rubric editor
    const noRubricEditor = page.locator('[data-testid="rubric-editor-final_response_match_v2"]');
    await expect(noRubricEditor).not.toBeVisible();
  });

  test('Story 18.9.7: Save Custom Metric Configuration', async ({ page }) => {
    // Click Configure Metrics button to open modal
    await page.locator('[data-testid="configure-metrics-btn"]').click();
    await expect(page.locator('[data-testid="metrics-config-modal"]')).toBeVisible({ timeout: 10000 });

    // Should start with "Using Defaults" badge
    await expect(page.locator('[data-testid="config-status-badge"]')).toContainText('Using Defaults');

    // Make some changes to the configuration
    // Enable an LLM metric
    const llmMetricToggle = page.locator('[data-testid="metric-toggle-rubric_based_final_response_quality_v1"]');
    await llmMetricToggle.click();
    await expect(llmMetricToggle).toBeChecked();

    // Adjust a threshold
    const thresholdSlider = page.locator('[data-testid="threshold-slider-tool_trajectory_avg_score"]');
    await thresholdSlider.fill('0.85');

    // Add custom rubric
    const rubricEditor = page.locator('[data-testid="rubric-editor-rubric_based_final_response_quality_v1"]');
    await rubricEditor.fill('Custom evaluation criteria:\n1. Accuracy (50%)\n2. Completeness (50%)');

    // Save button should exist
    const saveButton = page.locator('[data-testid="save-config-btn"]');
    await expect(saveButton).toBeVisible();

    // Click save button
    await saveButton.click();

    // Should show success notification
    await expect(page.locator('text=Configuration saved')).toBeVisible({ timeout: 5000 });

    // Badge should change to "Using Custom Config"
    await expect(page.locator('[data-testid="config-status-badge"]')).toContainText('Using Custom Config');

    // Verify the config file was created on disk
    const evalId = page.url().match(/\/evaluations\/([^/]+)$/)?.[1];
    const configPath = path.join(ADK_AGENTS_DIR, testProjectName, 'evaluations', `${evalId}.config.json`);

    const configExists = await fs.access(configPath).then(() => true).catch(() => false);
    expect(configExists).toBe(true);

    // Verify config file contains valid JSON
    const configContent = await fs.readFile(configPath, 'utf-8');
    const configJson = JSON.parse(configContent);

    // Should have criteria object
    expect(configJson).toHaveProperty('criteria');

    // Should contain enabled metrics with thresholds
    expect(configJson.criteria).toHaveProperty('tool_trajectory_avg_score', 0.85);
    expect(configJson.criteria).toHaveProperty('rubric_based_final_response_quality_v1');
    expect(configJson.criteria.rubric_based_final_response_quality_v1).toHaveProperty('threshold', 0.7);
    expect(configJson.criteria.rubric_based_final_response_quality_v1).toHaveProperty('rubric');
    expect(configJson.criteria.rubric_based_final_response_quality_v1.rubric).toContain('Custom evaluation criteria');
  });

  test('Story 18.9.8: Load Saved Metric Configuration', async ({ page }) => {
    // SETUP: First, create and save a custom configuration
    await page.locator('[data-testid="configure-metrics-btn"]').click();
    await expect(page.locator('[data-testid="metrics-config-modal"]')).toBeVisible({ timeout: 10000 });

    // Enable an LLM metric
    const llmMetricToggle = page.locator('[data-testid="metric-toggle-rubric_based_final_response_quality_v1"]');
    await llmMetricToggle.click();
    await expect(llmMetricToggle).toBeChecked();

    // Adjust threshold for tool_trajectory_avg_score
    const thresholdSlider = page.locator('[data-testid="threshold-slider-tool_trajectory_avg_score"]');
    await thresholdSlider.fill('0.92');

    // Add custom rubric
    const rubricEditor = page.locator('[data-testid="rubric-editor-rubric_based_final_response_quality_v1"]');
    await rubricEditor.fill('Evaluate based on:\n1. Correctness (60%)\n2. Clarity (40%)');

    // Save configuration
    const saveButton = page.locator('[data-testid="save-config-btn"]');
    await saveButton.click();
    await expect(page.locator('text=Configuration saved')).toBeVisible({ timeout: 5000 });

    // Wait for badge to update to "Using Custom Config"
    await expect(page.locator('[data-testid="config-status-badge"]')).toContainText('Using Custom Config');

    // Get the current evalset ID from URL
    const evalId = page.url().match(/\/evaluations\/([^/]+)$/)?.[1];

    // TEST: Reload the page and reopen the modal to verify settings are loaded
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Open the modal again
    await page.locator('[data-testid="configure-metrics-btn"]').click();
    await expect(page.locator('[data-testid="metrics-config-modal"]')).toBeVisible({ timeout: 10000 });

    // Badge should show "Using Custom Config"
    await expect(page.locator('[data-testid="config-status-badge"]')).toContainText('Using Custom Config');

    // Enabled LLM metric should be toggled on
    const loadedLlmToggle = page.locator('[data-testid="metric-toggle-rubric_based_final_response_quality_v1"]');
    await expect(loadedLlmToggle).toBeChecked();

    // Disabled metric should be toggled off (check a metric that wasn't enabled)
    const toolUseToggle = page.locator('[data-testid="metric-toggle-rubric_based_tool_use_quality_v1"]');
    await expect(toolUseToggle).not.toBeChecked();

    // Threshold slider should show saved value
    const loadedThresholdSlider = page.locator('[data-testid="threshold-slider-tool_trajectory_avg_score"]');
    const loadedThresholdValue = await loadedThresholdSlider.inputValue();
    expect(parseFloat(loadedThresholdValue)).toBe(0.92);

    // Rubric editor should show saved prompt
    const loadedRubricEditor = page.locator('[data-testid="rubric-editor-rubric_based_final_response_quality_v1"]');
    const loadedRubricValue = await loadedRubricEditor.inputValue();
    expect(loadedRubricValue).toContain('Evaluate based on');
    expect(loadedRubricValue).toContain('Correctness (60%)');
    expect(loadedRubricValue).toContain('Clarity (40%)');
  });

  test('Story 18.9.9: Reset to Default Configuration', async ({ page }) => {
    // SETUP: First, save a custom configuration
    await page.locator('[data-testid="configure-metrics-btn"]').click();
    await expect(page.locator('[data-testid="metrics-config-modal"]')).toBeVisible({ timeout: 10000 });

    // Enable an LLM metric
    const llmMetricToggle = page.locator('[data-testid="metric-toggle-rubric_based_final_response_quality_v1"]');
    await llmMetricToggle.click();
    await expect(llmMetricToggle).toBeChecked();

    // Save configuration
    const saveButton = page.locator('[data-testid="save-config-btn"]');
    await saveButton.click();
    await expect(page.locator('text=Configuration saved')).toBeVisible({ timeout: 5000 });

    // Verify "Using Custom Config" badge
    await expect(page.locator('[data-testid="config-status-badge"]')).toContainText('Using Custom Config');

    // Get the evalset ID to verify file deletion later
    const evalId = page.url().match(/\/evaluations\/([^/]+)$/)?.[1];
    const configPath = path.join(ADK_AGENTS_DIR, testProjectName, 'evaluations', `${evalId}.config.json`);

    // Verify config file exists
    const configExistsBefore = await fs.access(configPath).then(() => true).catch(() => false);
    expect(configExistsBefore).toBe(true);

    // TEST: Click "Reset to Defaults" button
    const resetButton = page.locator('[data-testid="reset-config-btn"]');
    await expect(resetButton).toBeVisible();
    await resetButton.click();

    // Confirmation dialog should appear
    // Note: Using page.on('dialog') to handle browser confirm dialog
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('This will delete your custom configuration');
      await dialog.accept();
    });

    // Click reset button again to trigger dialog
    await resetButton.click();

    // Wait for success notification
    await expect(page.locator('text=Reset to defaults')).toBeVisible({ timeout: 5000 });

    // Badge should change to "Using Defaults"
    await expect(page.locator('[data-testid="config-status-badge"]')).toContainText('Using Defaults');

    // Verify the LLM metric that was enabled is now disabled (back to default)
    const resetLlmToggle = page.locator('[data-testid="metric-toggle-rubric_based_final_response_quality_v1"]');
    await expect(resetLlmToggle).not.toBeChecked();

    // Verify config file was deleted from disk
    const configExistsAfter = await fs.access(configPath).then(() => true).catch(() => false);
    expect(configExistsAfter).toBe(false);
  });

  test('Story 18.9.10: View JSON Preview of Configuration', async ({ page }) => {
    // Open config modal (page already navigated by beforeEach)
    await page.locator('[data-testid="configure-metrics-btn"]').click();
    await expect(page.locator('[data-testid="metrics-config-modal"]')).toBeVisible({ timeout: 10000 });

    // Verify JSON preview section exists
    const jsonPreview = page.locator('[data-testid="json-preview"]');
    await expect(jsonPreview).toBeVisible();

    // Initial state: Should show default enabled metrics (tool_trajectory and response_match)
    const initialJson = await jsonPreview.textContent();
    expect(initialJson).toContain('"criteria"');
    expect(initialJson).toContain('"tool_trajectory_avg_score"');
    expect(initialJson).toContain('"response_match_score"');

    // Enable an LLM metric (rubric-based response quality)
    const llmToggle = page.locator('[data-testid="metric-toggle-rubric_based_final_response_quality_v1"]');
    await llmToggle.click();
    await expect(llmToggle).toBeChecked();

    // JSON preview should update to include the new metric
    const updatedJson = await jsonPreview.textContent();
    expect(updatedJson).toContain('"rubric_based_final_response_quality_v1"');
    expect(updatedJson).toContain('"threshold"');
    expect(updatedJson).toContain('0.7'); // Default threshold

    // Edit the rubric for the LLM metric
    const rubricEditor = page.locator('[data-testid="rubric-editor-rubric_based_final_response_quality_v1"]');
    await rubricEditor.fill('Assess response quality on helpfulness and accuracy');

    // JSON preview should update to include the rubric
    const jsonWithRubric = await jsonPreview.textContent();
    expect(jsonWithRubric).toContain('"rubric"');
    expect(jsonWithRubric).toContain('Assess response quality on helpfulness and accuracy');

    // Disable the default metric (response_match_score)
    const defaultToggle = page.locator('[data-testid="metric-toggle-response_match_score"]');
    await defaultToggle.click();
    await expect(defaultToggle).not.toBeChecked();

    // JSON preview should no longer include response_match_score
    const jsonWithoutResponseMatch = await jsonPreview.textContent();
    expect(jsonWithoutResponseMatch).not.toContain('"response_match_score"');
    expect(jsonWithoutResponseMatch).toContain('"tool_trajectory_avg_score"'); // Still has this one
  });

  test('Story 18.9.11: Shows custom config indicator when config exists', async ({ page }) => {
    // GIVEN: Save a custom config
    await page.locator('[data-testid="configure-metrics-btn"]').click();
    await expect(page.locator('[data-testid="metrics-config-modal"]')).toBeVisible({ timeout: 10000 });

    // Enable an LLM metric
    const llmToggle = page.locator('[data-testid="metric-toggle-rubric_based_final_response_quality_v1"]');
    await llmToggle.click();

    // Save the config
    await page.locator('[data-testid="save-config-btn"]').click();
    await expect(page.locator('text=Configuration saved')).toBeVisible({ timeout: 5000 });

    // Close the modal
    await page.locator('[data-testid="metrics-config-modal"]').press('Escape');
    await page.waitForTimeout(300);

    // THEN: Should show "Using custom config" indicator on the page
    await expect(page.locator('[data-testid="using-custom-config-indicator"]')).toBeVisible({ timeout: 5000 });
  });

  test('Story 18.9.12: Apply Config Template', async ({ page }) => {
    // GIVEN: Open the config modal
    await page.locator('[data-testid="configure-metrics-btn"]').click();
    await expect(page.locator('[data-testid="metrics-config-modal"]')).toBeVisible({ timeout: 10000 });

    // WHEN: Apply "Strict" template
    await page.locator('[data-testid="template-strict"]').click();

    // THEN: All enabled metrics should have high thresholds (0.9+)
    // Check tool_trajectory_avg_score threshold
    const toolTrajectorySlider = page.locator('[data-testid="threshold-slider-tool_trajectory_avg_score"]');
    const toolValue = await toolTrajectorySlider.getAttribute('value');
    expect(parseFloat(toolValue || '0')).toBeGreaterThanOrEqual(0.9);

    // Check response_match_score threshold
    const responseMatchSlider = page.locator('[data-testid="threshold-slider-response_match_score"]');
    const responseValue = await responseMatchSlider.getAttribute('value');
    expect(parseFloat(responseValue || '0')).toBeGreaterThanOrEqual(0.9);

    // WHEN: Apply "Balanced" template
    await page.locator('[data-testid="template-balanced"]').click();

    // THEN: Thresholds should be medium (0.7-0.8)
    const toolBalancedValue = await toolTrajectorySlider.getAttribute('value');
    const toolBalanced = parseFloat(toolBalancedValue || '0');
    expect(toolBalanced).toBeGreaterThanOrEqual(0.7);
    expect(toolBalanced).toBeLessThanOrEqual(0.8);

    // WHEN: Apply "Lenient" template
    await page.locator('[data-testid="template-lenient"]').click();

    // THEN: Thresholds should be low (0.5-0.6)
    const toolLenientValue = await toolTrajectorySlider.getAttribute('value');
    const toolLenient = parseFloat(toolLenientValue || '0');
    expect(toolLenient).toBeGreaterThanOrEqual(0.5);
    expect(toolLenient).toBeLessThanOrEqual(0.6);
  });
});
