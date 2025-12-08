import { test, expect } from '@playwright/test';
import { ADK_AGENTS_DIR } from './helpers';
import fs from 'fs/promises';
import path from 'path';

test.describe.configure({ mode: 'serial' });

/**
 * Story 7.1: Delete Project API
 * - DELETE /api/agents/[name] deletes the project
 * - All YAML files in project directory are deleted
 * - __init__.py is removed
 * - Project no longer appears in agent list
 */
test.describe('ADK Visual Builder - Story 7.1: Delete Project API', () => {
  const TEST_DELETE_PROJECT = 'test_delete_project';

  // Helper to create a test project
  async function createTestProject(page: import('@playwright/test').Page) {
    const response = await page.request.post('/api/agents', {
      data: {
        name: TEST_DELETE_PROJECT,
      },
    });
    expect(response.ok()).toBe(true);
  }

  // Cleanup helper (in case test fails)
  async function cleanupProject() {
    const projectDir = path.join(ADK_AGENTS_DIR, TEST_DELETE_PROJECT);
    try {
      const files = await fs.readdir(projectDir);
      for (const file of files) {
        await fs.unlink(path.join(projectDir, file));
      }
      await fs.rmdir(projectDir);
    } catch {
      // Directory might not exist, that's ok
    }
  }

  test.beforeEach(async () => {
    await cleanupProject();
  });

  test.afterEach(async () => {
    await cleanupProject();
  });

  test('DELETE /api/agents/[name] removes project directory', async ({ page }) => {
    // GIVEN: A project exists
    await createTestProject(page);
    const projectDir = path.join(ADK_AGENTS_DIR, TEST_DELETE_PROJECT);
    const dirExistsBefore = await fs.access(projectDir).then(() => true).catch(() => false);
    expect(dirExistsBefore).toBe(true);

    // WHEN: We call DELETE /api/agents/[name]
    const response = await page.request.delete(`/api/agents/${TEST_DELETE_PROJECT}`);

    // THEN: The request should succeed
    expect(response.ok()).toBe(true);

    // AND: The project directory should no longer exist
    const dirExistsAfter = await fs.access(projectDir).then(() => true).catch(() => false);
    expect(dirExistsAfter).toBe(false);
  });

  test('project no longer appears in agent list after deletion', async ({ page }) => {
    // GIVEN: A project exists
    await createTestProject(page);

    // Verify project is in the list
    const listBeforeResponse = await page.request.get('/api/agents');
    const dataBefore = await listBeforeResponse.json();
    const projectNamesBefore = dataBefore.agents.map((a: { id: string }) => a.id);
    expect(projectNamesBefore).toContain(TEST_DELETE_PROJECT);

    // WHEN: We delete the project
    const deleteResponse = await page.request.delete(`/api/agents/${TEST_DELETE_PROJECT}`);
    expect(deleteResponse.ok()).toBe(true);

    // THEN: The project should no longer appear in the list
    const listAfterResponse = await page.request.get('/api/agents');
    const dataAfter = await listAfterResponse.json();
    const projectNamesAfter = dataAfter.agents.map((a: { id: string }) => a.id);
    expect(projectNamesAfter).not.toContain(TEST_DELETE_PROJECT);
  });

  test('delete returns 404 for non-existent project', async ({ page }) => {
    // WHEN: We try to delete a non-existent project
    const response = await page.request.delete('/api/agents/non_existent_project');

    // THEN: The request should return 404
    expect(response.status()).toBe(404);
  });

  test('delete removes all YAML files and __init__.py', async ({ page }) => {
    // GIVEN: A project exists with multiple YAML files
    await createTestProject(page);

    // Add an additional agent file
    const additionalAgentResponse = await page.request.post(`/api/agents/${TEST_DELETE_PROJECT}/files`, {
      data: {
        name: 'helper_agent',
        agentClass: 'LlmAgent',
        model: 'gemini-2.0-flash',
        description: 'Helper agent',
        instruction: 'You are a helper.',
      },
    });
    expect(additionalAgentResponse.ok()).toBe(true);

    // Verify multiple files exist
    const projectDir = path.join(ADK_AGENTS_DIR, TEST_DELETE_PROJECT);
    const filesBefore = await fs.readdir(projectDir);
    expect(filesBefore).toContain('__init__.py');
    expect(filesBefore).toContain('root_agent.yaml');
    expect(filesBefore).toContain('helper_agent.yaml');

    // WHEN: We delete the project
    const deleteResponse = await page.request.delete(`/api/agents/${TEST_DELETE_PROJECT}`);
    expect(deleteResponse.ok()).toBe(true);

    // THEN: The entire directory should be gone
    const dirExists = await fs.access(projectDir).then(() => true).catch(() => false);
    expect(dirExists).toBe(false);
  });
});

/**
 * Story 7.2: Delete Project UI
 * - Delete button appears on project card
 * - Clicking delete shows confirmation dialog
 * - Confirming delete removes project from list
 * - Canceling delete keeps project intact
 */
test.describe('ADK Visual Builder - Story 7.2: Delete Project UI', () => {
  const TEST_UI_DELETE_PROJECT = 'test_ui_delete_project';

  // Helper to create a test project
  async function createTestProject(page: import('@playwright/test').Page) {
    const response = await page.request.post('/api/agents', {
      data: {
        name: TEST_UI_DELETE_PROJECT,
      },
    });
    expect(response.ok()).toBe(true);
  }

  // Cleanup helper
  async function cleanupProject() {
    const projectDir = path.join(ADK_AGENTS_DIR, TEST_UI_DELETE_PROJECT);
    try {
      const files = await fs.readdir(projectDir);
      for (const file of files) {
        await fs.unlink(path.join(projectDir, file));
      }
      await fs.rmdir(projectDir);
    } catch {
      // Directory might not exist, that's ok
    }
  }

  test.beforeEach(async () => {
    await cleanupProject();
  });

  test.afterEach(async () => {
    await cleanupProject();
  });

  test('delete button appears on project card', async ({ page }) => {
    // GIVEN: A project exists
    await createTestProject(page);

    // WHEN: We view the ADK agents page
    await page.goto('/');
    await expect(page.locator('h1:has-text("ADK Agents")')).toBeVisible({ timeout: 10000 });

    // THEN: The project card should have a delete button
    const projectCard = page.locator(`[data-testid="project-card-${TEST_UI_DELETE_PROJECT}"]`);
    await expect(projectCard).toBeVisible();
    await expect(projectCard.locator('[data-testid="delete-project-button"]')).toBeVisible();
  });

  test('clicking delete shows confirmation dialog', async ({ page }) => {
    // GIVEN: A project exists and we're on the ADK agents page
    await createTestProject(page);
    await page.goto('/');
    await expect(page.locator('h1:has-text("ADK Agents")')).toBeVisible({ timeout: 10000 });

    // WHEN: We click the delete button
    const projectCard = page.locator(`[data-testid="project-card-${TEST_UI_DELETE_PROJECT}"]`);
    await projectCard.locator('[data-testid="delete-project-button"]').click();

    // THEN: A confirmation dialog should appear
    const dialog = page.locator('[data-testid="delete-confirmation-dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('text=Are you sure you want to delete')).toBeVisible();
    await expect(dialog.locator(`text=${TEST_UI_DELETE_PROJECT}`)).toBeVisible();
  });

  test('confirming delete removes project from list', async ({ page }) => {
    // GIVEN: A project exists and delete confirmation dialog is open
    await createTestProject(page);
    await page.goto('/');
    await expect(page.locator('h1:has-text("ADK Agents")')).toBeVisible({ timeout: 10000 });

    const projectCard = page.locator(`[data-testid="project-card-${TEST_UI_DELETE_PROJECT}"]`);
    await expect(projectCard).toBeVisible();
    await projectCard.locator('[data-testid="delete-project-button"]').click();
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();

    // WHEN: We confirm the deletion
    await page.click('[data-testid="confirm-delete-button"]');

    // THEN: The project should no longer appear in the list
    await expect(projectCard).not.toBeVisible({ timeout: 10000 });

    // AND: The dialog should be closed
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).not.toBeVisible();
  });

  test('canceling delete keeps project intact', async ({ page }) => {
    // GIVEN: A project exists and delete confirmation dialog is open
    await createTestProject(page);
    await page.goto('/');
    await expect(page.locator('h1:has-text("ADK Agents")')).toBeVisible({ timeout: 10000 });

    const projectCard = page.locator(`[data-testid="project-card-${TEST_UI_DELETE_PROJECT}"]`);
    await expect(projectCard).toBeVisible();
    await projectCard.locator('[data-testid="delete-project-button"]').click();
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();

    // WHEN: We cancel the deletion
    await page.click('[data-testid="cancel-delete-button"]');

    // THEN: The dialog should be closed
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).not.toBeVisible();

    // AND: The project should still be visible
    await expect(projectCard).toBeVisible();

    // AND: The project directory should still exist
    const projectDir = path.join(ADK_AGENTS_DIR, TEST_UI_DELETE_PROJECT);
    const dirExists = await fs.access(projectDir).then(() => true).catch(() => false);
    expect(dirExists).toBe(true);
  });
});
