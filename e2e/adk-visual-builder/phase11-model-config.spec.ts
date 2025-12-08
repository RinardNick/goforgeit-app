import { test, expect } from '@playwright/test';
import { TEST_PROJECT } from './helpers';

test.describe.configure({ mode: 'serial' });

/**
 * Phase 11: Model Configuration
 * - LlmAgent properties panel shows "Model Configuration" section
 * - Temperature slider (0.0 - 2.0)
 * - Max output tokens input
 * - Top-P slider (0.0 - 1.0)
 * - Top-K input
 * - Changes persist to YAML as generation_config
 */
// NOTE: All tests in Phase 11 are skipped due to React Flow timing issues when clicking agent nodes.
// The Model Configuration functionality is implemented and working - see ModelConfigSection.tsx
// The UI flow works when tested manually, but E2E tests fail because properties panel doesn't
// reliably appear after clicking agent nodes due to canvas re-render timing.
test.describe('ADK Visual Builder - Phase 11: Model Configuration', () => {
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
    const files = data.files || [];
    const testFiles = files.filter((f: { filename: string }) =>
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

  test('LlmAgent properties panel shows Model Configuration section', async ({ page }) => {
    // GIVEN: The root agent is an LlmAgent (marketing_team_lead)
    // WHEN: We load the compose page and select the root agent
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Click on the root agent node (marketing_team_lead is an LlmAgent)
    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
    await expect(agentNode).toBeVisible({ timeout: 5000 });
    await agentNode.click({ force: true });

    // THEN: The properties panel should show a "Model Configuration" section
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible({ timeout: 15000 });
    await expect(propertiesPanel.locator('[data-testid="model-config-section"]')).toBeVisible({ timeout: 10000 });
  });

  test('temperature slider is visible with correct range (0.0 - 2.0)', async ({ page }) => {
    // GIVEN: The root agent is an LlmAgent
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
    await agentNode.click({ force: true });

    // THEN: Temperature slider should be visible with correct attributes
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible();

    const temperatureSlider = propertiesPanel.locator('[data-testid="temperature-slider"]');
    await expect(temperatureSlider).toBeVisible();

    // Check slider input attributes
    const sliderInput = temperatureSlider.locator('input[type="range"]');
    await expect(sliderInput).toHaveAttribute('min', '0');
    await expect(sliderInput).toHaveAttribute('max', '2');
    await expect(sliderInput).toHaveAttribute('step', '0.1');
  });

  test('max output tokens input is visible', async ({ page }) => {
    // GIVEN: The root agent is an LlmAgent
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
    await agentNode.click({ force: true });

    // THEN: Max tokens input should be visible
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible();

    const maxTokensInput = propertiesPanel.locator('[data-testid="max-tokens-input"]');
    await expect(maxTokensInput).toBeVisible();

    // Check input attributes
    const input = maxTokensInput.locator('input[type="number"]');
    await expect(input).toHaveAttribute('min', '1');
  });

  test('top-p slider is visible with correct range (0.0 - 1.0)', async ({ page }) => {
    // GIVEN: The root agent is an LlmAgent
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
    await agentNode.click({ force: true });

    // THEN: Top-P slider should be visible with correct attributes
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible();

    const topPSlider = propertiesPanel.locator('[data-testid="top-p-slider"]');
    await expect(topPSlider).toBeVisible();

    // Check slider input attributes
    const sliderInput = topPSlider.locator('input[type="range"]');
    await expect(sliderInput).toHaveAttribute('min', '0');
    await expect(sliderInput).toHaveAttribute('max', '1');
    await expect(sliderInput).toHaveAttribute('step', '0.05');
  });

  test('top-k input is visible', async ({ page }) => {
    // GIVEN: The root agent is an LlmAgent
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
    await agentNode.click({ force: true });

    // THEN: Top-K input should be visible
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible();

    const topKInput = propertiesPanel.locator('[data-testid="top-k-input"]');
    await expect(topKInput).toBeVisible();

    // Check input attributes
    const input = topKInput.locator('input[type="number"]');
    await expect(input).toHaveAttribute('min', '1');
  });

  test('changing temperature updates YAML generation_config', async ({ page }) => {
    // GIVEN: The root agent is an LlmAgent without generation_config
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
    await agentNode.click({ force: true });

    // WHEN: We change the temperature slider to 0.7
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible();

    const temperatureSlider = propertiesPanel.locator('[data-testid="temperature-slider"] input[type="range"]');
    await temperatureSlider.click();
    await temperatureSlider.fill('0.7');
    // Blur to trigger the onChange handler properly
    await temperatureSlider.blur();

    // Wait for the YAML to be updated (give time for API call)
    await page.waitForTimeout(1000);

    // THEN: The YAML file should contain generation_config with temperature
    const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
    const data = await response.json();

    const agentFile = data.files.find((f: { filename: string }) => f.filename === 'root_agent.yaml');
    expect(agentFile).toBeDefined();
    expect(agentFile.yaml).toContain('generation_config:');
    expect(agentFile.yaml).toContain('temperature:');
    expect(agentFile.yaml).toMatch(/temperature:\s*0\.7/);
  });

  test('changing max_output_tokens updates YAML generation_config', async ({ page }) => {
    // GIVEN: The root agent is an LlmAgent without generation_config
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
    await agentNode.click({ force: true });

    // WHEN: We set max output tokens to 2048
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible();

    const maxTokensInput = propertiesPanel.locator('[data-testid="max-tokens-input"] input[type="number"]');
    await maxTokensInput.click();
    await maxTokensInput.fill('2048');
    // Blur to trigger the onChange handler properly
    await maxTokensInput.blur();

    // Wait for the YAML to be updated (give time for API call)
    await page.waitForTimeout(1000);

    // THEN: The YAML file should contain generation_config with max_output_tokens
    const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
    const data = await response.json();

    const agentFile = data.files.find((f: { filename: string }) => f.filename === 'root_agent.yaml');
    expect(agentFile).toBeDefined();
    expect(agentFile.yaml).toContain('generation_config:');
    expect(agentFile.yaml).toContain('max_output_tokens:');
    expect(agentFile.yaml).toMatch(/max_output_tokens:\s*2048/);
  });

  test('existing generation_config values are reflected in UI', async ({ page }) => {
    // GIVEN: The root agent has generation_config values
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'root_agent.yaml',
        yaml: `name: marketing_team_lead
agent_class: LlmAgent
model: gemini-2.5-flash
description: The main agent responsible for orchestrating the social media marketing team.
generation_config:
  temperature: 1.2
  max_output_tokens: 4096
  top_p: 0.9
  top_k: 40
sub_agents:
  - config_path: content_calendar_agent.yaml
  - config_path: copywriting_agent.yaml
  - config_path: scheduler_agent.yaml`,
      },
    });

    // WHEN: We load the compose page and select the agent
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
    await agentNode.click({ force: true });

    // THEN: The UI should reflect the existing values
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible();

    // Temperature should be 1.2
    const temperatureSlider = propertiesPanel.locator('[data-testid="temperature-slider"] input[type="range"]');
    await expect(temperatureSlider).toHaveValue('1.2');

    // Max tokens should be 4096
    const maxTokensInput = propertiesPanel.locator('[data-testid="max-tokens-input"] input[type="number"]');
    await expect(maxTokensInput).toHaveValue('4096');

    // Top-P should be 0.9
    const topPSlider = propertiesPanel.locator('[data-testid="top-p-slider"] input[type="range"]');
    await expect(topPSlider).toHaveValue('0.9');

    // Top-K should be 40
    const topKInput = propertiesPanel.locator('[data-testid="top-k-input"] input[type="number"]');
    await expect(topKInput).toHaveValue('40');
  });

  test('Model Configuration section only shows for LlmAgent (not non-LLM agents)', async ({ page }) => {
    // GIVEN: The root agent is an LlmAgent
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // WHEN: We click on the LlmAgent (root)
    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
    await expect(agentNode).toBeVisible({ timeout: 5000 });
    await agentNode.click({ force: true });

    // THEN: The properties panel should show Model Configuration section for LlmAgent
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible();
    await expect(propertiesPanel.locator('[data-testid="model-config-section"]')).toBeVisible();

    // AND: The Agent Type selector should be present (showing it's an LlmAgent)
    const agentTypeSelect = propertiesPanel.locator('select');
    await expect(agentTypeSelect.first()).toHaveValue('LlmAgent');
  });
});
