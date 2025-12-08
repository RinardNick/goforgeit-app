import { test, expect } from '@playwright/test';
import { ADK_AGENTS_DIR } from './helpers';
import fs from 'fs/promises';
import path from 'path';

test.describe.configure({ mode: 'serial' });

/**
 * Story 5.1: Create Project API
 * - POST /api/agents creates new project directory
 * - Directory contains __init__.py file
 * - Directory contains root_agent.yaml with default template
 * - Project appears in agent list
 */
test.describe('ADK Visual Builder - Story 5.1: Create Project API', () => {
  const TEST_NEW_PROJECT = 'test_new_project';

  // Cleanup helper for the new project
  async function cleanupNewProject() {
    const projectDir = path.join(ADK_AGENTS_DIR, TEST_NEW_PROJECT);
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
    await cleanupNewProject();
  });

  test.afterEach(async () => {
    await cleanupNewProject();
  });

  test('POST /api/agents creates new project directory', async ({ page }) => {
    // WHEN: We call POST /api/agents to create a new project
    const response = await page.request.post('/api/agents', {
      data: {
        name: TEST_NEW_PROJECT,
      },
    });

    // THEN: The request should succeed
    expect(response.ok()).toBe(true);

    // AND: The project directory should exist
    const projectDir = path.join(ADK_AGENTS_DIR, TEST_NEW_PROJECT);
    const dirExists = await fs.access(projectDir).then(() => true).catch(() => false);
    expect(dirExists).toBe(true);
  });

  test('directory contains __init__.py file', async ({ page }) => {
    // GIVEN: We create a new project
    const response = await page.request.post('/api/agents', {
      data: {
        name: TEST_NEW_PROJECT,
      },
    });
    expect(response.ok()).toBe(true);

    // THEN: The project directory should contain __init__.py
    const initPyPath = path.join(ADK_AGENTS_DIR, TEST_NEW_PROJECT, '__init__.py');
    const fileExists = await fs.access(initPyPath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
  });

  test('directory contains root_agent.yaml with default template', async ({ page }) => {
    // GIVEN: We create a new project
    const response = await page.request.post('/api/agents', {
      data: {
        name: TEST_NEW_PROJECT,
      },
    });
    expect(response.ok()).toBe(true);

    // THEN: The project directory should contain root_agent.yaml
    const rootAgentPath = path.join(ADK_AGENTS_DIR, TEST_NEW_PROJECT, 'root_agent.yaml');
    const fileExists = await fs.access(rootAgentPath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    // AND: The file should contain valid YAML with correct structure
    const content = await fs.readFile(rootAgentPath, 'utf-8');
    expect(content).toContain('name: root_agent');
    expect(content).toContain('agent_class: LlmAgent');
    expect(content).toContain('model:');
  });

  test('project appears in agent list', async ({ page }) => {
    // GIVEN: We create a new project
    const createResponse = await page.request.post('/api/agents', {
      data: {
        name: TEST_NEW_PROJECT,
      },
    });
    expect(createResponse.ok()).toBe(true);

    // WHEN: We fetch the agent list
    const listResponse = await page.request.get('/api/agents');
    expect(listResponse.ok()).toBe(true);

    const data = await listResponse.json();

    // THEN: The new project should appear in the list
    const projectNames = data.agents.map((a: { id: string }) => a.id);
    expect(projectNames).toContain(TEST_NEW_PROJECT);
  });
});

/**
 * Story 5.2: New Project UI
 * - "New Project" button opens creation dialog
 * - User can enter project name
 * - Created project opens in visual builder
 * - Canvas shows the root agent node
 */
test.describe('ADK Visual Builder - Story 5.2: New Project UI', () => {
  const TEST_UI_PROJECT = 'test_ui_project';

  // Cleanup helper for the UI test project
  async function cleanupUIProject() {
    const projectDir = path.join(ADK_AGENTS_DIR, TEST_UI_PROJECT);
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
    await cleanupUIProject();
  });

  test.afterEach(async () => {
    await cleanupUIProject();
  });

  test('"New Project" button opens creation dialog', async ({ page }) => {
    // GIVEN: We are on the ADK agents page
    await page.goto('/');
    await expect(page.locator('h1:has-text("ADK Agents")')).toBeVisible({ timeout: 10000 });

    // WHEN: We click the "New Project" button
    await page.click('button:has-text("New Project")');

    // THEN: A dialog should open with a form to create a new project
    await expect(page.locator('[data-testid="new-project-dialog"]')).toBeVisible();
    await expect(page.locator('input[name="projectName"]')).toBeVisible();
  });

  test('user can enter project name', async ({ page }) => {
    // GIVEN: We are on the ADK agents page with the dialog open
    await page.goto('/');
    await expect(page.locator('h1:has-text("ADK Agents")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("New Project")');
    await expect(page.locator('[data-testid="new-project-dialog"]')).toBeVisible();

    // WHEN: We enter a project name
    await page.fill('input[name="projectName"]', TEST_UI_PROJECT);

    // THEN: The input should contain the project name
    await expect(page.locator('input[name="projectName"]')).toHaveValue(TEST_UI_PROJECT);
  });

  test('created project opens in visual builder', async ({ page }) => {
    // GIVEN: We are on the ADK agents page with the dialog open
    await page.goto('/');
    await expect(page.locator('h1:has-text("ADK Agents")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("New Project")');
    await expect(page.locator('[data-testid="new-project-dialog"]')).toBeVisible();

    // WHEN: We enter a project name and submit
    await page.fill('input[name="projectName"]', TEST_UI_PROJECT);
    await page.click('button:has-text("Create")');

    // THEN: We should be redirected to the visual builder for the new project
    await expect(page).toHaveURL(new RegExp(`/${TEST_UI_PROJECT}/compose`), { timeout: 10000 });
  });

  test('canvas shows the root agent node', async ({ page }) => {
    // GIVEN: We are on the ADK agents page with the dialog open
    await page.goto('/');
    await expect(page.locator('h1:has-text("ADK Agents")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("New Project")');
    await expect(page.locator('[data-testid="new-project-dialog"]')).toBeVisible();

    // WHEN: We create a new project
    await page.fill('input[name="projectName"]', TEST_UI_PROJECT);
    await page.click('button:has-text("Create")');

    // THEN: The canvas should show the root agent node
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="agent-node"]:has-text("root_agent")')).toBeVisible({ timeout: 10000 });
  });
});
