/**
 * Phase 16: Additional Built-in Tools
 *
 * Tests for the additional built-in tools that ADK supports:
 * - transfer_to_agent: Transfer control to another agent
 * - escalate: Signal to parent agent that current agent can't handle request
 *
 * These tools were already supported by ADK but not exposed in our UI.
 */

import { test, expect } from '@playwright/test';
import { TEST_PROJECT } from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 16: Additional Built-in Tools', () => {
  // Helper to restore fixture files
  async function restoreFixtures(request: { fetch: Function }) {
    const rootAgentYaml = `name: marketing_team_lead
agent_class: LlmAgent
model: gemini-2.5-flash
description: The main agent responsible for orchestrating the social media marketing team.
sub_agents:
  - config_path: content_calendar_agent.yaml
  - config_path: copywriting_agent.yaml
  - config_path: scheduler_agent.yaml
`;
    await request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ filename: 'root_agent.yaml', yaml: rootAgentYaml }),
    });

    // Delete test files
    const filesResponse = await request.fetch(`/api/agents/${TEST_PROJECT}/files`);
    const data = await filesResponse.json();
    const testFiles = data.files.filter((f: { filename: string }) =>
      f.filename.startsWith('test_') || f.filename.startsWith('new_')
    );
    for (const file of testFiles) {
      await request.fetch(`/api/agents/${TEST_PROJECT}/files?filename=${file.filename}`, { method: 'DELETE' });
    }
  }

  test.beforeEach(async ({ page }) => {
    await restoreFixtures(page.request);
  });

  test.afterEach(async ({ page }) => {
    await restoreFixtures(page.request);
  });

  test.describe('Story 16.1: transfer_to_agent Tool', () => {
    test('transfer_to_agent tool appears in Agent Function Tools category', async ({ page }) => {
      // GIVEN: Navigate to compose page with an existing LlmAgent
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Click on root agent to select it
      const rootAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
      await expect(rootAgent).toBeVisible({ timeout: 5000 });
      await rootAgent.click({ force: true });

      // AND: Open the Add Tools dropdown and select Built-in Tools
      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await expect(propertiesPanel).toBeVisible({ timeout: 5000 });
      await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
      await expect(propertiesPanel.locator('[data-testid="add-tools-menu"]')).toBeVisible();
      await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();

      // AND: Click Add to open the modal
      await propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]').click();

      // THEN: The modal should contain transfer_to_agent in Agent Function Tools
      const modal = page.locator('[data-testid="builtin-tools-modal"]');
      await expect(modal).toBeVisible();
      await expect(modal.locator('[data-testid="modal-tool-transfer_to_agent"]')).toBeVisible();
    });

    test('transfer_to_agent has correct description', async ({ page }) => {
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      const rootAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
      await rootAgent.click({ force: true });

      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
      await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();
      await propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]').click();

      // THEN: transfer_to_agent should have proper description
      const modal = page.locator('[data-testid="builtin-tools-modal"]');
      const toolItem = modal.locator('[data-testid="modal-tool-transfer_to_agent"]');
      await expect(toolItem).toContainText('Transfer to agent');
    });
  });

  test.describe('Story 16.2: escalate Tool', () => {
    test('escalate tool appears in Agent Function Tools category', async ({ page }) => {
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      const rootAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
      await rootAgent.click({ force: true });

      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
      await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();
      await propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]').click();

      // THEN: The modal should contain escalate in Agent Function Tools
      const modal = page.locator('[data-testid="builtin-tools-modal"]');
      await expect(modal).toBeVisible();
      await expect(modal.locator('[data-testid="modal-tool-escalate"]')).toBeVisible();
    });

    test('escalate has correct description', async ({ page }) => {
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      const rootAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
      await rootAgent.click({ force: true });

      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
      await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();
      await propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]').click();

      const modal = page.locator('[data-testid="builtin-tools-modal"]');
      const toolItem = modal.locator('[data-testid="modal-tool-escalate"]');
      await expect(toolItem).toContainText('Escalate to parent');
    });
  });

});
