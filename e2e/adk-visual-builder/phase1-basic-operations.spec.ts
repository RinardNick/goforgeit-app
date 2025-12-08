/**
 * E2E Tests for ADK Visual Builder - Phase 1: Basic Operations
 *
 * Story 1.1: Fix file creation on drop
 * Story 1.2: Fix model field visibility
 * Story 1.3: Agent type-specific YAML generation
 */

import { test, expect } from '@playwright/test';
import { cleanupTestFiles, navigateToCompose, TEST_PROJECT } from './helpers';

test.describe.configure({ mode: 'serial' });

// ============================================================================
// Story 1.1: File Creation on Drop
// ============================================================================
test.describe.serial('ADK Visual Builder - Story 1.1: File Creation on Drop', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupTestFiles();
    await navigateToCompose(page);
  });

  test.afterEach(async () => {
    await cleanupTestFiles();
  });

  test('dropping an LlmAgent creates a YAML file in the project directory', async ({ page }) => {
    await expect(page.locator('[data-testid="agent-palette"]')).toBeVisible();
    await expect(page.locator('[data-testid="palette-llm-agent"]')).toBeVisible();

    const paletteItem = page.locator('[data-testid="palette-llm-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
    await expect(page.locator('[data-testid="agent-node"]').last()).toBeVisible({ timeout: 5000 });

    // Wait for file to be created (async operation)
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      const newFile = data.files.find((f: { filename: string }) => f.filename.startsWith('new_'));
      expect(newFile).toBeDefined();
    }).toPass({ timeout: 5000 });
  });

  test('the created file contains correct YAML structure with name and agent_class', async ({ page }) => {
    const paletteItem = page.locator('[data-testid="palette-llm-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
    await expect(page.locator('[data-testid="agent-node"]').last()).toBeVisible({ timeout: 5000 });

    // Wait for file to be created (async operation)
    let newFile: { filename: string; yaml: string } | undefined;
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      newFile = data.files.find((f: { filename: string; yaml: string }) =>
        f.filename.startsWith('new_') && f.yaml.includes('agent_class: LlmAgent')
      );
      expect(newFile).toBeDefined();
    }).toPass({ timeout: 5000 });

    expect(newFile!.yaml).toContain('name:');
    expect(newFile!.yaml).toContain('agent_class: LlmAgent');
    expect(newFile!.yaml).toContain('model:');
  });

  test('the filename matches the agent name in snake_case', async ({ page }) => {
    const paletteItem = page.locator('[data-testid="palette-llm-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
    const newNode = page.locator('[data-testid="agent-node"]').last();
    await expect(newNode).toBeVisible({ timeout: 5000 });

    const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
    const data = await response.json();
    const newFile = data.files.find((f: { filename: string; yaml: string }) => {
      const nameMatch = f.yaml.match(/name:\s*(\S+)/);
      if (nameMatch) {
        const expectedFilename = `${nameMatch[1]}.yaml`;
        return f.filename === expectedFilename;
      }
      return false;
    });

    expect(newFile).toBeDefined();
  });

  test('deleting a node deletes the YAML file', async ({ page }) => {
    const paletteItem = page.locator('[data-testid="palette-llm-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
    const newNode = page.locator('[data-testid="agent-node"]').last();
    await expect(newNode).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    const beforeResponse = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
    const beforeData = await beforeResponse.json();
    const newFile = beforeData.files.find((f: { filename: string }) => f.filename.startsWith('new_'));
    expect(newFile).toBeDefined();
    const fileCountBefore = beforeData.files.length;

    await newNode.click({ force: true });
    await page.click('[data-testid="delete-agent-button"]');
    await page.waitForTimeout(1000);

    const afterResponse = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
    const afterData = await afterResponse.json();
    const newFileAfter = afterData.files.find((f: { filename: string }) => f.filename.startsWith('new_'));

    expect(newFileAfter).toBeUndefined();
    expect(afterData.files.length).toBeLessThan(fileCountBefore);
  });
});

// ============================================================================
// Story 1.2: Model Field Visibility
// ============================================================================
test.describe.serial('ADK Visual Builder - Story 1.2: Model Field Visibility', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupTestFiles();
    await navigateToCompose(page);
  });

  test.afterEach(async () => {
    await cleanupTestFiles();
  });

  test('LlmAgent shows model dropdown in properties panel', async ({ page }) => {
    const paletteItem = page.locator('[data-testid="palette-llm-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
    const newNode = page.locator('[data-testid="agent-node"]').last();
    await expect(newNode).toBeVisible({ timeout: 5000 });
    await newNode.click({ force: true });

    await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="model-select"]')).toBeVisible();
  });

  test('SequentialAgent does NOT show model dropdown', async ({ page }) => {
    const paletteItem = page.locator('[data-testid="palette-sequential-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
    await page.waitForTimeout(500);
    const newNode = page.locator('[data-testid="container-node-sequential"]').last();
    await expect(newNode).toBeVisible({ timeout: 5000 });
    await newNode.click({ force: true });

    await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="model-select"]')).not.toBeVisible();
  });

  test('ParallelAgent does NOT show model dropdown', async ({ page }) => {
    const paletteItem = page.locator('[data-testid="palette-parallel-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
    await page.waitForTimeout(500);
    const newNode = page.locator('[data-testid="container-node-parallel"]').last();
    await expect(newNode).toBeVisible({ timeout: 5000 });
    await newNode.click({ force: true });

    await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="model-select"]')).not.toBeVisible();
  });

  test('LoopAgent does NOT show model dropdown', async ({ page }) => {
    const paletteItem = page.locator('[data-testid="palette-loop-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
    await page.waitForTimeout(500);
    const newNode = page.locator('[data-testid="container-node-loop"]').last();
    await expect(newNode).toBeVisible({ timeout: 5000 });
    await newNode.click({ force: true });

    await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="model-select"]')).not.toBeVisible();
  });
});

// ============================================================================
// Story 1.3: Type-Specific YAML Generation
// ============================================================================
test.describe.serial('ADK Visual Builder - Story 1.3: Type-Specific YAML Generation', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupTestFiles();
    await navigateToCompose(page);
  });

  test.afterEach(async () => {
    await cleanupTestFiles();
  });

  test('LlmAgent YAML includes model field', async ({ page }) => {
    const paletteItem = page.locator('[data-testid="palette-llm-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
    await page.waitForTimeout(1000);

    const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
    const data = await response.json();
    const llmFile = data.files.find((f: { yaml: string }) =>
      f.yaml.includes('agent_class: LlmAgent') && f.yaml.includes('model:')
    );

    expect(llmFile).toBeDefined();
    expect(llmFile.yaml).toContain('model:');
  });

  test('SequentialAgent YAML does NOT include model field', async ({ page }) => {
    const paletteItem = page.locator('[data-testid="palette-sequential-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
    await page.waitForTimeout(1000);

    const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
    const data = await response.json();
    const seqFile = data.files.find((f: { yaml: string }) =>
      f.yaml.includes('agent_class: SequentialAgent')
    );

    expect(seqFile).toBeDefined();
    expect(seqFile.yaml).not.toContain('model:');
  });

  test('ParallelAgent YAML does NOT include model field', async ({ page }) => {
    const paletteItem = page.locator('[data-testid="palette-parallel-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
    await page.waitForTimeout(1000);

    const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
    const data = await response.json();
    const parFile = data.files.find((f: { yaml: string }) =>
      f.yaml.includes('agent_class: ParallelAgent')
    );

    expect(parFile).toBeDefined();
    expect(parFile.yaml).not.toContain('model:');
  });

  test('LoopAgent YAML does NOT include model field', async ({ page }) => {
    const paletteItem = page.locator('[data-testid="palette-loop-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
    await page.waitForTimeout(1000);

    const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
    const data = await response.json();
    const loopFile = data.files.find((f: { yaml: string }) =>
      f.yaml.includes('agent_class: LoopAgent')
    );

    expect(loopFile).toBeDefined();
    expect(loopFile.yaml).not.toContain('model:');
  });
});
