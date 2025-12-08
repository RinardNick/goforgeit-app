import { test, expect } from '@playwright/test';
import { TEST_PROJECT } from './helpers';

test.describe.configure({ mode: 'serial' });

/**
 * Phase 9.7: Tool Confirmation Workflow
 * - User can toggle require_confirmation for any tool
 * - User can set confirmation_prompt when confirmation is required
 * - Visual indicator shows which tools require confirmation
 * - YAML generation includes confirmation config
 */
test.describe('ADK Visual Builder - Phase 9.7: Tool Confirmation', () => {
  // Helper to restore fixture files
  async function restoreFixtures(request: { fetch: Function }) {
    const rootAgentYaml = `name: marketing_team_lead
agent_class: LlmAgent
model: gemini-2.5-flash
description: The main agent responsible for orchestrating the social media marketing team.
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

  test('user can enable require_confirmation for a built-in tool', async ({ page }) => {
    // GIVEN: An LlmAgent with google_search tool exists
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_confirmation_agent.yaml',
        yaml: `name: test_confirmation_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Agent for testing tool confirmation
tools:
  - google_search`,
      },
    });

    // WHEN: We load the compose page and select the agent
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Click on the agent node to select it
    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_confirmation_agent' });
    await expect(agentNode).toBeVisible({ timeout: 5000 });
    await agentNode.click({ force: true });

    // THEN: The properties panel should show the tool with a confirmation toggle
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible({ timeout: 5000 });

    // Expand Built-in Tools section
    const builtinSection = propertiesPanel.locator('[data-testid="builtin-tools-section"]');
    await expect(builtinSection).toBeVisible();

    // Find google_search tool card
    const toolCard = builtinSection.locator('[data-testid="tool-card-google_search"]');
    await expect(toolCard).toBeVisible();

    // WHEN: User clicks on the tool card to expand configuration
    await toolCard.click();

    // THEN: Confirmation toggle should be visible
    const confirmToggle = toolCard.locator('[data-testid="tool-require-confirmation-toggle"]');
    await expect(confirmToggle).toBeVisible();
    await expect(confirmToggle).not.toBeChecked();

    // WHEN: User enables require_confirmation
    await confirmToggle.check();

    // THEN: Confirmation prompt input should appear
    const confirmPromptInput = toolCard.locator('[data-testid="tool-confirmation-prompt-input"]');
    await expect(confirmPromptInput).toBeVisible();

    // WHEN: User enters a custom confirmation prompt
    await confirmPromptInput.fill('Are you sure you want to search the web?');

    // THEN: Visual indicator should show tool requires confirmation
    await expect(toolCard.locator('[data-testid="tool-confirmation-indicator"]')).toBeVisible();

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_confirmation_agent.yaml`);
  });

  test('YAML generation includes confirmation config', async ({ page }) => {
    // GIVEN: An LlmAgent exists
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_yaml_confirmation.yaml',
        yaml: `name: test_yaml_confirmation
agent_class: LlmAgent
model: gemini-2.5-flash
description: Agent for testing YAML confirmation`,
      },
    });

    // WHEN: We add a tool with confirmation requirements
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_yaml_confirmation' });
    await expect(agentNode).toBeVisible({ timeout: 5000 });
    await agentNode.click({ force: true });

    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible({ timeout: 5000 });

    // Add google_search tool
    await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
    await propertiesPanel.locator('[data-testid="add-tools-menu"]').waitFor({ state: 'visible' });
    await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();

    const modal = page.locator('[data-testid="add-builtin-tools-modal"]');
    await expect(modal).toBeVisible();
    await modal.locator('[data-testid="tool-toggle-google_search"]').check();
    await modal.locator('[data-testid="save-builtin-tools-btn"]').click();

    // Enable confirmation for google_search
    const builtinSection = propertiesPanel.locator('[data-testid="builtin-tools-section"]');
    const toolCard = builtinSection.locator('[data-testid="tool-card-google_search"]');
    await toolCard.click();

    const confirmToggle = toolCard.locator('[data-testid="tool-require-confirmation-toggle"]');
    await confirmToggle.check();

    const confirmPromptInput = toolCard.locator('[data-testid="tool-confirmation-prompt-input"]');
    await confirmPromptInput.fill('Confirm web search?');

    // Switch to YAML view
    await page.locator('[data-testid="view-mode-yaml"]').click();
    await page.waitForTimeout(500);

    // THEN: YAML should include confirmation config
    const yamlEditor = page.locator('[data-testid="yaml-editor-test_yaml_confirmation.yaml"]');
    await expect(yamlEditor).toBeVisible();
    const yamlContent = await yamlEditor.locator('textarea').inputValue();

    expect(yamlContent).toContain('google_search');
    expect(yamlContent).toContain('require_confirmation: true');
    expect(yamlContent).toContain('confirmation_prompt: Confirm web search?');

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_yaml_confirmation.yaml`);
  });

  test('existing YAML with confirmation config loads into UI', async ({ page }) => {
    // GIVEN: An agent with a tool that has confirmation configured
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_load_confirmation.yaml',
        yaml: `name: test_load_confirmation
agent_class: LlmAgent
model: gemini-2.5-flash
description: Agent with confirmation config
tools:
  - name: google_search
    require_confirmation: true
    confirmation_prompt: Please confirm this search`,
      },
    });

    // WHEN: We load the compose page
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_load_confirmation' });
    await expect(agentNode).toBeVisible({ timeout: 5000 });
    await agentNode.click({ force: true });

    // THEN: The UI should reflect the confirmation config
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    const builtinSection = propertiesPanel.locator('[data-testid="builtin-tools-section"]');
    const toolCard = builtinSection.locator('[data-testid="tool-card-google_search"]');
    await toolCard.click();

    // Confirmation toggle should be checked
    const confirmToggle = toolCard.locator('[data-testid="tool-require-confirmation-toggle"]');
    await expect(confirmToggle).toBeChecked();

    // Confirmation prompt should have the value from YAML
    const confirmPromptInput = toolCard.locator('[data-testid="tool-confirmation-prompt-input"]');
    await expect(confirmPromptInput).toHaveValue('Please confirm this search');

    // Visual indicator should be visible
    await expect(toolCard.locator('[data-testid="tool-confirmation-indicator"]')).toBeVisible();

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_load_confirmation.yaml`);
  });

  test('visual indicator appears on agent node when tools require confirmation', async ({ page }) => {
    // GIVEN: An agent with a tool that requires confirmation
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_visual_indicator.yaml',
        yaml: `name: test_visual_indicator
agent_class: LlmAgent
model: gemini-2.5-flash
description: Agent with confirmation tool
tools:
  - name: google_search
    require_confirmation: true
    confirmation_prompt: Confirm?`,
      },
    });

    // WHEN: We load the compose page
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // THEN: The agent node should show a visual indicator
    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_visual_indicator' });
    await expect(agentNode).toBeVisible({ timeout: 5000 });

    // Badge or icon indicating confirmation required
    await expect(agentNode.locator('[data-testid="agent-confirmation-badge"]')).toBeVisible();

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_visual_indicator.yaml`);
  });
});
