/**
 * E2E Tests for ADK Visual Builder - Phase 6: Plus Button Features
 *
 * Story 6.1: Plus button on agents to add connected child agents
 * Story 6.2: Plus button inside container nodes to add sub-agents
 */

import { test, expect } from '@playwright/test';
import { cleanupTestFiles, navigateToCompose, TEST_PROJECT } from './helpers';

test.describe.configure({ mode: 'serial' });

// ============================================================================
// Story 6.1: Plus Button on Agent Nodes
// ============================================================================
test.describe.serial('ADK Visual Builder - Story 6.1: Plus Button on Agent Nodes', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupTestFiles();
    await navigateToCompose(page);
  });

  test.afterEach(async () => {
    await cleanupTestFiles();
  });

  test('LlmAgent node shows a plus button below it', async ({ page }) => {
    // GIVEN: We create an LlmAgent on the canvas
    const paletteItem = page.locator('[data-testid="palette-llm-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });

    const newNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'New Llm' });
    await expect(newNode).toBeVisible({ timeout: 5000 });

    // THEN: A plus button should be visible below the node
    const plusButton = newNode.locator('[data-testid="add-child-button"]');
    await expect(plusButton).toBeVisible();
  });

  test('clicking plus button opens agent type dropdown', async ({ page }) => {
    // GIVEN: An LlmAgent on the canvas
    const paletteItem = page.locator('[data-testid="palette-llm-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });

    const newNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'New Llm' });
    await expect(newNode).toBeVisible({ timeout: 5000 });

    // WHEN: We click the plus button
    const plusButton = newNode.locator('[data-testid="add-child-button"]');
    await plusButton.click();

    // THEN: A dropdown with agent type options should appear
    const dropdown = page.locator('[data-testid="agent-type-dropdown"]');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.locator('text=LLM Agent')).toBeVisible();
    await expect(dropdown.locator('text=Sequential')).toBeVisible();
    await expect(dropdown.locator('text=Parallel')).toBeVisible();
    await expect(dropdown.locator('text=Loop')).toBeVisible();
  });

  test('selecting agent type from dropdown creates a connected child agent', async ({ page }) => {
    // GIVEN: An LlmAgent on the canvas with the plus button dropdown open
    const paletteItem = page.locator('[data-testid="palette-llm-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    // Get initial node count (project may have pre-existing agents)
    const initialNodeCount = await page.locator('[data-testid="agent-node"]').count();

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });

    const parentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'New Llm' });
    await expect(parentNode).toBeVisible({ timeout: 5000 });

    // Wait for file to be created
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      const newFile = data.files.find((f: { filename: string }) => f.filename.startsWith('new_'));
      expect(newFile).toBeDefined();
    }).toPass({ timeout: 5000 });

    const plusButton = parentNode.locator('[data-testid="add-child-button"]');
    await plusButton.click();

    // WHEN: We select "LLM Agent" from the dropdown
    const dropdown = page.locator('[data-testid="agent-type-dropdown"]');
    await dropdown.locator('text=LLM Agent').click();

    // THEN: A new LlmAgent should appear (we should have one more agent node than before)
    await expect(page.locator('[data-testid="agent-node"]')).toHaveCount(initialNodeCount + 2, { timeout: 5000 });

    // AND: The new agent file should be created
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      // We should have the parent and a child file
      const newFiles = data.files.filter((f: { filename: string }) => f.filename.startsWith('new_'));
      expect(newFiles.length).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 5000 });

    // AND: The parent YAML should have the child as a sub_agent
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      const parentFile = data.files.find((f: { filename: string }) => f.filename.startsWith('new_llm'));
      expect(parentFile).toBeDefined();
      expect(parentFile.yaml).toContain('sub_agents:');
    }).toPass({ timeout: 5000 });
  });

  test('created child agent appears below the parent visually', async ({ page }) => {
    // GIVEN: A parent LlmAgent
    const paletteItem = page.locator('[data-testid="palette-llm-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    // Get initial node count (project may have pre-existing agents)
    const initialNodeCount = await page.locator('[data-testid="agent-node"]').count();

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 100 } });

    // Wait for the parent node (may show as "New Llm" or "new_llm" after API refresh)
    const parentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: /new.?llm/i });
    await expect(parentNode.first()).toBeVisible({ timeout: 5000 });

    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      const newFile = data.files.find((f: { filename: string }) => f.filename.startsWith('new_'));
      expect(newFile).toBeDefined();
    }).toPass({ timeout: 5000 });

    // WHEN: We add a child via the plus button
    const plusButton = parentNode.first().locator('[data-testid="add-child-button"]');
    await plusButton.click();
    await page.locator('[data-testid="agent-type-dropdown"]').locator('text=LLM Agent').click();

    // Wait for the child node to appear
    await expect(page.locator('[data-testid="agent-node"]')).toHaveCount(initialNodeCount + 2, { timeout: 5000 });

    // THEN: The parent and child should have a vertical relationship
    // Find the LlmAgent nodes we created (may be "new_llm" and "new_llm_1")
    const newLlmNodes = page.locator('[data-testid="agent-node"]').filter({ hasText: /new.?llm/i });
    await expect(newLlmNodes).toHaveCount(2, { timeout: 5000 });

    const allNewNodes = await newLlmNodes.all();
    const firstBox = await allNewNodes[0].boundingBox();
    const secondBox = await allNewNodes[1].boundingBox();

    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();
    // One should be below the other (different Y values)
    expect(firstBox!.y).not.toBe(secondBox!.y);
  });
});

// ============================================================================
// Story 6.2: Plus Button Inside Container Nodes
// ============================================================================
test.describe.serial('ADK Visual Builder - Story 6.2: Plus Button Inside Container Nodes', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupTestFiles();
    await navigateToCompose(page);
  });

  test.afterEach(async () => {
    await cleanupTestFiles();
  });

  test('SequentialAgent container shows a plus button inside', async ({ page }) => {
    // GIVEN: We create a SequentialAgent on the canvas
    const paletteItem = page.locator('[data-testid="palette-sequential-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });

    const containerNode = page.locator('[data-testid="container-node-sequential"]');
    await expect(containerNode).toBeVisible({ timeout: 5000 });

    // THEN: A plus button should be visible inside the container's drop zone
    const plusButton = containerNode.locator('[data-testid="container-add-button"]');
    await expect(plusButton).toBeVisible();
  });

  test('ParallelAgent container shows a plus button inside', async ({ page }) => {
    // GIVEN: We create a ParallelAgent on the canvas
    const paletteItem = page.locator('[data-testid="palette-parallel-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });

    const containerNode = page.locator('[data-testid="container-node-parallel"]');
    await expect(containerNode).toBeVisible({ timeout: 5000 });

    // THEN: A plus button should be visible inside the container's drop zone
    const plusButton = containerNode.locator('[data-testid="container-add-button"]');
    await expect(plusButton).toBeVisible();
  });

  test('LoopAgent container shows a plus button inside', async ({ page }) => {
    // GIVEN: We create a LoopAgent on the canvas
    const paletteItem = page.locator('[data-testid="palette-loop-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });

    const containerNode = page.locator('[data-testid="container-node-loop"]');
    await expect(containerNode).toBeVisible({ timeout: 5000 });

    // THEN: A plus button should be visible inside the container's drop zone
    const plusButton = containerNode.locator('[data-testid="container-add-button"]');
    await expect(plusButton).toBeVisible();
  });

  test('clicking container plus button opens agent type dropdown', async ({ page }) => {
    // GIVEN: A SequentialAgent on the canvas
    const paletteItem = page.locator('[data-testid="palette-sequential-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });

    const containerNode = page.locator('[data-testid="container-node-sequential"]');
    await expect(containerNode).toBeVisible({ timeout: 5000 });

    // WHEN: We click the plus button inside the container
    const plusButton = containerNode.locator('[data-testid="container-add-button"]');
    await plusButton.click();

    // THEN: A dropdown with agent type options should appear
    const dropdown = page.locator('[data-testid="agent-type-dropdown"]');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.locator('text=LLM Agent')).toBeVisible();
    await expect(dropdown.locator('text=Sequential')).toBeVisible();
    await expect(dropdown.locator('text=Parallel')).toBeVisible();
    await expect(dropdown.locator('text=Loop')).toBeVisible();
  });

  test('selecting agent type from container dropdown creates a sub-agent inside', async ({ page }) => {
    // GIVEN: A SequentialAgent on the canvas with plus button dropdown open
    const paletteItem = page.locator('[data-testid="palette-sequential-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });

    const containerNode = page.locator('[data-testid="container-node-sequential"]');
    await expect(containerNode).toBeVisible({ timeout: 5000 });

    // Wait for container file to be created
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      const newFile = data.files.find((f: { filename: string }) => f.filename.startsWith('new_'));
      expect(newFile).toBeDefined();
    }).toPass({ timeout: 5000 });

    const plusButton = containerNode.locator('[data-testid="container-add-button"]');
    await plusButton.click();

    // WHEN: We select "LLM Agent" from the dropdown
    const dropdown = page.locator('[data-testid="agent-type-dropdown"]');
    await dropdown.locator('text=LLM Agent').click();

    // THEN: The container should now show the child agent inside
    await expect(containerNode.locator('[data-testid="container-child-agent"]')).toBeVisible({ timeout: 5000 });

    // AND: The container's YAML should have the sub_agent
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      const containerFile = data.files.find((f: { filename: string }) => f.filename.startsWith('new_sequential'));
      expect(containerFile).toBeDefined();
      expect(containerFile.yaml).toContain('sub_agents:');
    }).toPass({ timeout: 5000 });
  });

  test('adding multiple sub-agents via plus button shows them all inside container', async ({ page }) => {
    // GIVEN: A SequentialAgent on the canvas
    const paletteItem = page.locator('[data-testid="palette-sequential-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });

    const containerNode = page.locator('[data-testid="container-node-sequential"]');
    await expect(containerNode).toBeVisible({ timeout: 5000 });

    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      const newFile = data.files.find((f: { filename: string }) => f.filename.startsWith('new_'));
      expect(newFile).toBeDefined();
    }).toPass({ timeout: 5000 });

    // WHEN: We add two sub-agents via the plus button
    // First sub-agent
    let plusButton = containerNode.locator('[data-testid="container-add-button"]');
    await plusButton.scrollIntoViewIfNeeded();
    await plusButton.click({ force: true });

    // Wait for dropdown and click
    let dropdown = page.locator('[data-testid="agent-type-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 5000 });
    await dropdown.locator('text=LLM Agent').click();

    await expect(containerNode.locator('[data-testid="container-child-agent"]')).toHaveCount(1, { timeout: 5000 });

    // Wait for file to be created via API before proceeding
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      const containerFile = data.files.find((f: { filename: string }) => f.filename.startsWith('new_sequential'));
      expect(containerFile).toBeDefined();
      expect(containerFile.yaml).toContain('config_path:');
    }).toPass({ timeout: 5000 });

    // Wait for UI to fully settle after first sub-agent addition
    await page.waitForTimeout(500);

    // Re-fetch container reference after API refresh rebuilt the nodes
    const refreshedContainer = page.locator('[data-testid="container-node-sequential"]');
    await expect(refreshedContainer).toBeVisible({ timeout: 5000 });

    // Wait for the dropdown to be closed before clicking the plus button again
    await expect(page.locator('[data-testid="agent-type-dropdown"]')).not.toBeVisible({ timeout: 3000 });

    // Second sub-agent - scroll container into view and click the plus button
    plusButton = refreshedContainer.locator('[data-testid="container-add-button"]');
    await expect(plusButton).toBeVisible({ timeout: 5000 });

    // Scroll the entire container into view and wait for animations
    await refreshedContainer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Click using JavaScript to bypass any overlay issues
    await plusButton.evaluate((el) => {
      (el as HTMLButtonElement).click();
    });

    // Wait for the dropdown to appear
    dropdown = page.locator('[data-testid="agent-type-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Click LLM Agent option using JavaScript
    const llmOption = dropdown.locator('button', { hasText: 'LLM Agent' });
    await llmOption.evaluate((el) => {
      (el as HTMLButtonElement).click();
    });

    // THEN: The container should show both child agents
    await expect(refreshedContainer.locator('[data-testid="container-child-agent"]')).toHaveCount(2, { timeout: 5000 });

    // AND: The container's YAML should have both sub_agents
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      const containerFile = data.files.find((f: { filename: string }) => f.filename.startsWith('new_sequential'));
      expect(containerFile).toBeDefined();
      // Check that there are multiple config_path entries
      const matches = containerFile.yaml.match(/config_path:/g);
      expect(matches?.length).toBe(2);
    }).toPass({ timeout: 10000 });
  });
});
