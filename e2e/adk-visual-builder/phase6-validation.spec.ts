/**
 * E2E Tests for ADK Visual Builder - Phase 6: YAML Validation
 *
 * Story 6.1: Detect broken config_path references
 * Story 6.2: Show validation errors in UI
 * Story 6.3: Prevent execution with broken references
 */

import { test, expect } from '@playwright/test';
import { cleanupTestFiles, navigateToCompose, TEST_PROJECT } from './helpers';

test.describe.configure({ mode: 'serial' });

// ============================================================================
// Story 6.1: Detect Broken config_path References
// ============================================================================
test.describe('ADK Visual Builder - Story 6.1: Detect Broken References', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupTestFiles();
    await navigateToCompose(page);
  });

  test.afterEach(async () => {
    await cleanupTestFiles();
  });

  test('validation detects broken sub_agents reference', async ({ page }) => {
    // Create an agent with a broken reference
    const brokenAgentYaml = `name: broken_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Agent with broken reference
sub_agents:
  - config_path: non_existent_agent.yaml
`;

    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      headers: { 'Content-Type': 'application/json' },
      data: { filename: 'broken_agent.yaml', yaml: brokenAgentYaml },
    });

    // Reload page
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

    // Click the broken agent node
    const brokenNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'broken_agent' });
    await expect(brokenNode).toBeVisible({ timeout: 5000 });
    await brokenNode.click();

    // Properties panel should show validation error
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible();

    // Look for validation error indicator
    const validationError = propertiesPanel.locator('[data-testid="validation-error"]');
    await expect(validationError).toBeVisible();
    await expect(validationError).toContainText('non_existent_agent.yaml');
    await expect(validationError).toContainText('not found');
  });

  test('validation detects broken AgentTool reference', async ({ page }) => {
    // Create an agent with broken AgentTool reference
    const brokenToolAgentYaml = `name: broken_tool_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Agent with broken tool reference
tools:
  - name: AgentTool
    args:
      agent:
        config_path: missing_tool_agent.yaml
`;

    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      headers: { 'Content-Type': 'application/json' },
      data: { filename: 'broken_tool_agent.yaml', yaml: brokenToolAgentYaml },
    });

    // Reload page
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

    // Click the broken agent node
    const brokenNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'broken_tool_agent' });
    await expect(brokenNode).toBeVisible({ timeout: 5000 });
    await brokenNode.click();

    // Properties panel should show validation error
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible();

    // Look for validation error indicator
    const validationError = propertiesPanel.locator('[data-testid="validation-error"]');
    await expect(validationError).toBeVisible();
    await expect(validationError).toContainText('missing_tool_agent.yaml');
    await expect(validationError).toContainText('not found');
  });

  test('validation passes when all references exist', async ({ page }) => {
    // Create two agents with valid references
    const helperAgentYaml = `name: helper_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Helper agent
`;

    const mainAgentYaml = `name: main_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Main agent with valid reference
sub_agents:
  - config_path: helper_agent.yaml
`;

    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      headers: { 'Content-Type': 'application/json' },
      data: { filename: 'helper_agent.yaml', yaml: helperAgentYaml },
    });

    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      headers: { 'Content-Type': 'application/json' },
      data: { filename: 'main_agent.yaml', yaml: mainAgentYaml },
    });

    // Reload page
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

    // Click the main agent node
    const mainNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'main_agent' });
    await expect(mainNode).toBeVisible({ timeout: 5000 });
    await mainNode.click();

    // Properties panel should NOT show validation error
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible();

    // Validation error should not exist
    const validationError = propertiesPanel.locator('[data-testid="validation-error"]');
    await expect(validationError).not.toBeVisible();
  });
});

// ============================================================================
// Story 6.2: Show Validation Errors in Canvas
// ============================================================================
test.describe('ADK Visual Builder - Story 6.2: Visual Error Indicators', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupTestFiles();
  });

  test.afterEach(async () => {
    await cleanupTestFiles();
  });

  test('broken agent node shows error badge on canvas', async ({ page }) => {
    // Create an agent with a broken reference
    const brokenAgentYaml = `name: broken_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Agent with broken reference
sub_agents:
  - config_path: non_existent_agent.yaml
`;

    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      headers: { 'Content-Type': 'application/json' },
      data: { filename: 'broken_agent.yaml', yaml: brokenAgentYaml },
    });

    await navigateToCompose(page);

    // Agent node should have error indicator
    const brokenNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'broken_agent' });
    await expect(brokenNode).toBeVisible({ timeout: 5000 });

    // Check for error badge
    const errorBadge = brokenNode.locator('[data-testid="node-error-badge"]');
    await expect(errorBadge).toBeVisible();
    await expect(errorBadge).toContainText('!');
  });
});

// ============================================================================
// Story 6.3: Prevent Execution with Broken References
// ============================================================================
test.describe('ADK Visual Builder - Story 6.3: Block Execution', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupTestFiles();
  });

  test.afterEach(async () => {
    await cleanupTestFiles();
  });

  test('cannot run agent with broken references', async ({ page }) => {
    // Create broken agent
    const brokenAgentYaml = `name: root_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Broken root agent
sub_agents:
  - config_path: missing_agent.yaml
`;

    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      headers: { 'Content-Type': 'application/json' },
      data: { filename: 'root_agent.yaml', yaml: brokenAgentYaml },
    });

    // Navigate to chat page
    await page.goto(`/${TEST_PROJECT}/chat`);

    // Try to send a message
    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Input should be disabled or show error
    const sendButton = page.locator('[data-testid="send-button"]');
    await expect(sendButton).toBeDisabled();

    // Should show validation error message
    const errorMessage = page.locator('[data-testid="validation-error-message"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('broken reference');
  });
});
