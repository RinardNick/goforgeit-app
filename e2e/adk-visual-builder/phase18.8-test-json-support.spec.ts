/**
 * Phase 18.8: .test.json File Support
 *
 * Enables users to import/export ADK-standard .test.json files for:
 * - Sharing evalsets between projects
 * - Version control of evaluation test cases
 * - Integration with ADK CLI workflows
 * - Collaboration with other ADK users
 */

import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');

// Sample .test.json file content (valid ADK format)
const SAMPLE_TEST_JSON = {
  eval_set_id: 'imported_test_set',
  name: 'Imported Test Set',
  description: 'Test evalset imported from .test.json file',
  eval_cases: [
    {
      eval_id: 'case_1',
      conversation: [
        {
          invocation_id: 'turn_1',
          user_content: {
            parts: [{ text: 'What is 2+2?' }],
            role: 'user',
          },
          final_response: {
            parts: [{ text: 'The answer is 4' }],
            role: 'model',
          },
          intermediate_data: {
            tool_uses: [],
            intermediate_responses: [],
          },
        },
      ],
    },
  ],
};

test.describe('Phase 18.8: .test.json File Support', () => {
  const testProjectName = 'test_json_support_project';

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

    // Just wait for agent canvas to be ready
    await page.waitForSelector('[data-testid="agent-canvas"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="agent-node"]:has-text("root_agent")', { timeout: 10000 });
  });

  test.afterEach(async () => {
    // Clean up test project
    try {
      await fs.rm(path.join(ADK_AGENTS_DIR, testProjectName), { recursive: true, force: true });
    } catch {}
  });

  test('Story 18.8.1: Import button exists on evaluations page', async ({ page }) => {
    // Navigate to evaluations page
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible({ timeout: 10000 });

    // Check that import button is visible
    await expect(page.locator('[data-testid="import-evalset-btn"]')).toBeVisible();
  });

  test('Story 18.8.2: User can upload .test.json file via import dialog', async ({ page }) => {
    // Navigate to evaluations page
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    // Click import button
    await page.locator('[data-testid="import-evalset-btn"]').click();

    // Import dialog should open
    await expect(page.locator('[data-testid="import-evalset-dialog"]')).toBeVisible();

    // Create a temporary .test.json file
    const tmpDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpFilePath = path.join(tmpDir, 'sample.test.json');
    await fs.writeFile(tmpFilePath, JSON.stringify(SAMPLE_TEST_JSON, null, 2));

    // Upload the file
    const fileInput = page.locator('[data-testid="import-file-input"]');
    await fileInput.setInputFiles(tmpFilePath);

    // Confirm import
    await page.locator('[data-testid="confirm-import-btn"]').click();

    // Should see success message
    await expect(page.locator('text=Imported successfully')).toBeVisible({ timeout: 5000 });

    // Clean up tmp file
    await fs.rm(tmpFilePath, { force: true });
  });

  test('Story 18.8.3: Imported evalset appears in evalset list', async ({ page }) => {
    // Navigate to evaluations page
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    // Import a .test.json file
    await page.locator('[data-testid="import-evalset-btn"]').click();
    await expect(page.locator('[data-testid="import-evalset-dialog"]')).toBeVisible();

    const tmpDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpFilePath = path.join(tmpDir, 'sample2.test.json');
    await fs.writeFile(tmpFilePath, JSON.stringify(SAMPLE_TEST_JSON, null, 2));

    const fileInput = page.locator('[data-testid="import-file-input"]');
    await fileInput.setInputFiles(tmpFilePath);
    await page.locator('[data-testid="confirm-import-btn"]').click();
    await expect(page.locator('text=Imported successfully')).toBeVisible({ timeout: 5000 });

    // Check that imported evalset appears in the list
    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="evalset-card"]')).toContainText('Imported Test Set');

    // Clean up
    await fs.rm(tmpFilePath, { force: true });
  });

  test('Story 18.8.4: Imported evalset can be opened and edited', async ({ page }) => {
    // Navigate to evaluations page and import
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    await page.locator('[data-testid="import-evalset-btn"]').click();
    const tmpDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpFilePath = path.join(tmpDir, 'sample3.test.json');
    await fs.writeFile(tmpFilePath, JSON.stringify(SAMPLE_TEST_JSON, null, 2));

    const fileInput = page.locator('[data-testid="import-file-input"]');
    await fileInput.setInputFiles(tmpFilePath);
    await page.locator('[data-testid="confirm-import-btn"]').click();
    await expect(page.locator('text=Imported successfully')).toBeVisible({ timeout: 5000 });

    // Wait for evalset card to appear with correct content before clicking
    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="evalset-card"]')).toContainText('Imported Test Set');

    // Click "View Details" to open the evalset
    await Promise.all([
      page.waitForURL(/\/evaluations\/[^/]+$/),
      page.locator('[data-testid="evalset-card"]').locator('text=View Details').click(),
    ]);

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Wait for the evalset name header to confirm page loaded
    await expect(page.locator('h1:has-text("Imported Test Set")')).toBeVisible({ timeout: 10000 });

    // Should see the imported conversation
    await expect(page.locator('[data-testid="conversation-card"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="conversation-card"]')).toContainText('What is 2+2?');

    // Clean up
    await fs.rm(tmpFilePath, { force: true });
  });

  test('Story 18.8.5: Export button exists on evalset detail page', async ({ page }) => {
    // Navigate to evaluations page
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    // Create a simple evalset
    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await dialog.locator('input[name="name"]').fill('Export Test');
    await page.locator('[data-testid="confirm-create-evalset"]').click();

    await expect(page.locator('[data-testid="evalset-card"]')).toBeVisible();

    // Navigate to eval detail page
    await Promise.all([
      page.waitForURL(/\/evaluations\/[^/]+$/),
      page.locator('[data-testid="evalset-card"]').locator('text=View Details').click(),
    ]);

    // Check that export button exists
    await expect(page.locator('[data-testid="export-evalset-btn"]')).toBeVisible();
  });

  test('Story 18.8.6: Export downloads valid .test.json file', async ({ page }) => {
    // Navigate to evaluations page and create evalset
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await dialog.locator('input[name="name"]').fill('Export Test 2');
    await page.locator('[data-testid="confirm-create-evalset"]').click();

    await Promise.all([
      page.waitForURL(/\/evaluations\/[^/]+$/),
      page.locator('[data-testid="evalset-card"]').locator('text=View Details').click(),
    ]);

    // Add a conversation
    await page.locator('[data-testid="add-conversation-btn"]').click();
    await page.locator('[data-testid="user-message-input-0"]').fill('Test question');
    await page.locator('[data-testid="expected-response-input-0"]').fill('Test response');
    await page.locator('[data-testid="save-conversation-btn"]').click();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    await page.locator('[data-testid="export-evalset-btn"]').click();

    // Wait for download
    const download = await downloadPromise;

    // Check filename
    expect(download.suggestedFilename()).toMatch(/\.test\.json$/);

    // Save and verify file content
    const tmpDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });
    const downloadPath = path.join(tmpDir, download.suggestedFilename());
    await download.saveAs(downloadPath);

    const fileContent = await fs.readFile(downloadPath, 'utf-8');
    const parsed = JSON.parse(fileContent);

    // Verify it has required ADK .test.json structure
    expect(parsed).toHaveProperty('eval_set_id');
    expect(parsed).toHaveProperty('name');
    expect(parsed).toHaveProperty('eval_cases');
    expect(Array.isArray(parsed.eval_cases)).toBe(true);

    // Clean up
    await fs.rm(downloadPath, { force: true });
  });

  test('Story 18.8.7: Exported file can be re-imported (round-trip test)', async ({ page }) => {
    // Create evalset with conversation
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    await page.locator('[data-testid="create-evalset-btn"]').click();
    const dialog = page.locator('[data-testid="create-evalset-dialog"]');
    await dialog.locator('input[name="name"]').fill('Round Trip Test');
    await dialog.locator('textarea[name="description"]').fill('Testing export-import round trip');
    await page.locator('[data-testid="confirm-create-evalset"]').click();

    await Promise.all([
      page.waitForURL(/\/evaluations\/[^/]+$/),
      page.locator('[data-testid="evalset-card"]').locator('text=View Details').click(),
    ]);

    // Add a conversation with specific details
    await page.locator('[data-testid="add-conversation-btn"]').click();
    await page.locator('[data-testid="user-message-input-0"]').fill('Round trip question');
    await page.locator('[data-testid="expected-response-input-0"]').fill('Round trip answer');
    await page.locator('[data-testid="save-conversation-btn"]').click();

    // Export the evalset
    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-testid="export-evalset-btn"]').click();
    const download = await downloadPromise;

    const tmpDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });
    const downloadPath = path.join(tmpDir, 'roundtrip.test.json');
    await download.saveAs(downloadPath);

    // Navigate back to evaluations page
    await page.goto(`/${testProjectName}/evaluations`);
    await expect(page.locator('[data-testid="evaluations-page"]')).toBeVisible();

    // Delete the original evalset first (to avoid 409 conflict on re-import)
    const deleteButton = page.locator('[data-testid="evalset-card"]').locator('[data-testid="delete-evalset-btn"]');
    await deleteButton.click();
    await page.locator('[data-testid="confirm-delete-evalset"]').click();
    await expect(page.locator('[data-testid="evalset-card"]')).toHaveCount(0);

    // Import the exported file
    await page.locator('[data-testid="import-evalset-btn"]').click();
    await expect(page.locator('[data-testid="import-evalset-dialog"]')).toBeVisible();

    const fileInput = page.locator('[data-testid="import-file-input"]');
    await fileInput.setInputFiles(downloadPath);
    await page.locator('[data-testid="confirm-import-btn"]').click();
    await expect(page.locator('text=Imported successfully')).toBeVisible({ timeout: 5000 });

    // Verify imported evalset has same content
    const evalsetCards = page.locator('[data-testid="evalset-card"]');
    await expect(evalsetCards).toHaveCount(1); // Just the re-imported one

    // Open the imported evalset
    await evalsetCards.locator('text=View Details').click();
    await page.waitForURL(/\/evaluations\/[^/]+$/);

    // Verify conversation content matches
    await expect(page.locator('[data-testid="conversation-card"]')).toContainText('Round trip question');

    // Clean up
    await fs.rm(downloadPath, { force: true });
  });
});
