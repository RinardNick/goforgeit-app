/**
 * Phase 10: Callbacks System Tests
 *
 * Tests for the callbacks configuration panel in the ADK Visual Builder.
 * ADK supports 6 callback types:
 * - before_agent_callbacks
 * - after_agent_callbacks
 * - before_model_callbacks
 * - after_model_callbacks
 * - before_tool_callbacks
 * - after_tool_callbacks
 *
 * YAML format:
 * before_model_callbacks:
 *   - name: my_library.callbacks.callback_function
 *     args:
 *       - name: param_name
 *         value: param_value
 */

import { test, expect, TEST_PROJECT, restoreToolsFixtures } from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 10: Callbacks System', () => {
  test.beforeEach(async ({ page }) => {
    await restoreToolsFixtures(page.request);
  });

  // NOTE: All tests in Phase 10 are skipped due to React Flow timing issues when creating agents via API.
  // The Callbacks functionality is implemented and working - see CallbacksSection.tsx
  // The UI flow works when tested manually, but E2E tests fail because properties panel doesn't
  // reliably appear after clicking agent nodes due to canvas re-render timing.
  test.describe('Story 10.1: Callbacks Panel UI', () => {
    test('Callbacks section visible in properties panel for LlmAgent', async ({ page }) => {
      // GIVEN: An LlmAgent exists in the project
      await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
        data: {
          filename: 'test_callbacks_agent.yaml',
          yaml: `name: test_callbacks_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing callbacks`,
        },
      });

      // WHEN: We load the compose page and select the agent
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      // Click on the agent node to select it
      const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_callbacks_agent' });
      await expect(agentNode).toBeVisible({ timeout: 10000 });
      await agentNode.click({ force: true });
      await page.waitForTimeout(500);

      // THEN: The properties panel should show a "Callbacks" section
      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await expect(propertiesPanel).toBeVisible({ timeout: 15000 });

      // Scroll to and verify Callbacks section
      const callbacksSection = propertiesPanel.locator('[data-testid="callbacks-section"]');
      await callbacksSection.scrollIntoViewIfNeeded();
      await expect(callbacksSection).toBeVisible({ timeout: 5000 });
      // Verify the heading exists within the callbacks section
      await expect(callbacksSection.locator('h4:has-text("Callbacks")')).toBeVisible();

      // Cleanup
      await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_callbacks_agent.yaml`);
    });

    test('Callbacks section shows empty state initially', async ({ page }) => {
      // GIVEN: An LlmAgent exists without callbacks
      await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
        data: {
          filename: 'test_callbacks_empty.yaml',
          yaml: `name: test_callbacks_empty
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent without callbacks`,
        },
      });

      // WHEN: We load and select the agent
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_callbacks_empty' });
      await expect(agentNode).toBeVisible({ timeout: 10000 });
      await agentNode.click({ force: true });
      await page.waitForTimeout(500);

      // Scroll to Callbacks section
      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      const callbacksSection = propertiesPanel.locator('[data-testid="callbacks-section"]');
      await callbacksSection.scrollIntoViewIfNeeded();

      // THEN: Should show empty state
      await expect(page.locator('[data-testid="callbacks-empty-state"]')).toBeVisible();
      await expect(page.locator('text=No callbacks configured')).toBeVisible();

      // Cleanup
      await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_callbacks_empty.yaml`);
    });

    test('Shows all 6 callback type buttons', async ({ page }) => {
      // GIVEN: An LlmAgent exists
      await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
        data: {
          filename: 'test_callbacks_types.yaml',
          yaml: `name: test_callbacks_types
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing callback types`,
        },
      });

      // WHEN: We load and select the agent
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_callbacks_types' });
      await expect(agentNode).toBeVisible({ timeout: 10000 });
      await agentNode.click({ force: true });
      await page.waitForTimeout(500);

      // Scroll to Callbacks section
      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await expect(propertiesPanel).toBeVisible({ timeout: 15000 });
      const callbacksSection = propertiesPanel.locator('[data-testid="callbacks-section"]');
      await expect(callbacksSection).toBeVisible({ timeout: 10000 });
      await callbacksSection.scrollIntoViewIfNeeded();

      // Click Add Callback dropdown
      await page.click('[data-testid="add-callback-button"]');

      // THEN: Should see all 6 callback types
      await expect(page.locator('[data-testid="callback-type-before_agent"]')).toBeVisible();
      await expect(page.locator('[data-testid="callback-type-after_agent"]')).toBeVisible();
      await expect(page.locator('[data-testid="callback-type-before_model"]')).toBeVisible();
      await expect(page.locator('[data-testid="callback-type-after_model"]')).toBeVisible();
      await expect(page.locator('[data-testid="callback-type-before_tool"]')).toBeVisible();
      await expect(page.locator('[data-testid="callback-type-after_tool"]')).toBeVisible();

      // Cleanup
      await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_callbacks_types.yaml`);
    });
  });

  test.describe('Story 10.2: Add Callback Dialog', () => {
    test('Clicking callback type opens add dialog', async ({ page }) => {
      // GIVEN: An LlmAgent exists
      await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
        data: {
          filename: 'test_callbacks_dialog.yaml',
          yaml: `name: test_callbacks_dialog
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing callback dialog`,
        },
      });

      // WHEN: We load and select the agent
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_callbacks_dialog' });
      await expect(agentNode).toBeVisible({ timeout: 10000 });
      await agentNode.click({ force: true });
      await page.waitForTimeout(500);

      // Scroll to Callbacks section
      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      const callbacksSection = propertiesPanel.locator('[data-testid="callbacks-section"]');
      await callbacksSection.scrollIntoViewIfNeeded();

      // Click Add Callback and select before_model
      await page.click('[data-testid="add-callback-button"]');
      await page.click('[data-testid="callback-type-before_model"]');

      // THEN: Should see dialog
      await expect(page.locator('[data-testid="add-callback-dialog"]')).toBeVisible();
      await expect(page.locator('text=Add Before Model Callback')).toBeVisible();

      // Cleanup
      await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_callbacks_dialog.yaml`);
    });

    test('Add callback dialog has function name input', async ({ page }) => {
      // GIVEN: An LlmAgent exists
      await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
        data: {
          filename: 'test_callbacks_input.yaml',
          yaml: `name: test_callbacks_input
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing callback input`,
        },
      });

      // WHEN: We load and select the agent
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_callbacks_input' });
      await expect(agentNode).toBeVisible({ timeout: 10000 });
      await agentNode.click({ force: true });
      await page.waitForTimeout(500);

      // Scroll and open dialog
      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      const callbacksSection = propertiesPanel.locator('[data-testid="callbacks-section"]');
      await callbacksSection.scrollIntoViewIfNeeded();
      await page.click('[data-testid="add-callback-button"]');
      await page.click('[data-testid="callback-type-before_model"]');

      // THEN: Should have function name input
      await expect(page.locator('[data-testid="callback-function-name-input"]')).toBeVisible();
      await expect(page.locator('text=Function Path')).toBeVisible();
      // Placeholder should show example
      await expect(page.locator('[data-testid="callback-function-name-input"]')).toHaveAttribute(
        'placeholder',
        'my_library.callbacks.function_name'
      );

      // Cleanup
      await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_callbacks_input.yaml`);
    });

    test('Can add callback with function name', async ({ page }) => {
      // GIVEN: An LlmAgent exists
      await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
        data: {
          filename: 'test_callbacks_add.yaml',
          yaml: `name: test_callbacks_add
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing adding callbacks`,
        },
      });

      // WHEN: We load and select the agent
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1500);

      const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_callbacks_add' });
      await expect(agentNode).toBeVisible({ timeout: 10000 });
      await agentNode.click({ force: true });
      await page.waitForTimeout(800);

      // Verify properties panel is visible
      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await expect(propertiesPanel).toBeVisible({ timeout: 5000 });

      // Scroll and open dialog
      const callbacksSection = propertiesPanel.locator('[data-testid="callbacks-section"]');
      await expect(callbacksSection).toBeVisible({ timeout: 5000 });
      await callbacksSection.scrollIntoViewIfNeeded();
      await page.click('[data-testid="add-callback-button"]');
      await page.click('[data-testid="callback-type-before_model"]');

      // Fill function name
      await page.fill('[data-testid="callback-function-name-input"]', 'my_callbacks.security.validate_input');

      // Click Add button
      await page.click('[data-testid="add-callback-submit"]');

      // THEN: Dialog should close
      await expect(page.locator('[data-testid="add-callback-dialog"]')).not.toBeVisible();

      // Callback should appear in list
      await expect(page.locator('[data-testid="callback-card"]').filter({ hasText: 'Before Model' })).toBeVisible();
      await expect(page.locator('text=my_callbacks.security.validate_input')).toBeVisible();

      // Cleanup
      await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_callbacks_add.yaml`);
    });
  });

  test.describe('Story 10.3: Callback Management', () => {
    test('Can delete a callback', async ({ page }) => {
      // GIVEN: An LlmAgent exists
      await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
        data: {
          filename: 'test_callbacks_delete.yaml',
          yaml: `name: test_callbacks_delete
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing callback deletion`,
        },
      });

      // WHEN: We load and select the agent
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_callbacks_delete' });
      await expect(agentNode).toBeVisible({ timeout: 10000 });
      await agentNode.click({ force: true });
      await page.waitForTimeout(500);

      // Scroll and add a callback first
      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      const callbacksSection = propertiesPanel.locator('[data-testid="callbacks-section"]');
      await callbacksSection.scrollIntoViewIfNeeded();
      await page.click('[data-testid="add-callback-button"]');
      await page.click('[data-testid="callback-type-after_tool"]');
      await page.fill('[data-testid="callback-function-name-input"]', 'my_callbacks.logging.log_tool_result');
      await page.click('[data-testid="add-callback-submit"]');

      // Verify callback exists
      const callbackCard = page.locator('[data-testid="callback-card"]').filter({ hasText: 'After Tool' });
      await expect(callbackCard).toBeVisible();

      // Delete it
      await callbackCard.locator('[data-testid="delete-callback-button"]').click();

      // THEN: Should be gone
      await expect(callbackCard).not.toBeVisible();

      // Cleanup
      await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_callbacks_delete.yaml`);
    });

    test('Multiple callbacks of same type can be added', async ({ page }) => {
      // GIVEN: An LlmAgent exists
      await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
        data: {
          filename: 'test_callbacks_multi.yaml',
          yaml: `name: test_callbacks_multi
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing multiple callbacks`,
        },
      });

      // WHEN: We load and select the agent
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_callbacks_multi' });
      await expect(agentNode).toBeVisible({ timeout: 10000 });
      await agentNode.click({ force: true });
      await page.waitForTimeout(500);

      // Wait for properties panel and scroll
      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await expect(propertiesPanel).toBeVisible({ timeout: 15000 });
      const callbacksSection = propertiesPanel.locator('[data-testid="callbacks-section"]');
      await expect(callbacksSection).toBeVisible({ timeout: 10000 });
      await callbacksSection.scrollIntoViewIfNeeded();

      // Add first before_model callback
      await page.click('[data-testid="add-callback-button"]');
      await page.click('[data-testid="callback-type-before_model"]');
      await page.fill('[data-testid="callback-function-name-input"]', 'callbacks.security.validate');
      await page.click('[data-testid="add-callback-submit"]');

      // Add second before_model callback
      await page.click('[data-testid="add-callback-button"]');
      await page.click('[data-testid="callback-type-before_model"]');
      await page.fill('[data-testid="callback-function-name-input"]', 'callbacks.logging.log_request');
      await page.click('[data-testid="add-callback-submit"]');

      // THEN: Both should be visible
      await expect(page.locator('text=callbacks.security.validate')).toBeVisible();
      await expect(page.locator('text=callbacks.logging.log_request')).toBeVisible();

      // Should have 2 before_model callbacks
      const beforeModelCallbacks = page.locator('[data-testid="callback-card"]').filter({ hasText: 'Before Model' });
      await expect(beforeModelCallbacks).toHaveCount(2);

      // Cleanup
      await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_callbacks_multi.yaml`);
    });
  });

  test.describe('Story 10.4: YAML Generation', () => {
    test('Callbacks generate correct YAML format', async ({ page }) => {
      // GIVEN: An LlmAgent exists
      await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
        data: {
          filename: 'test_callbacks_yaml.yaml',
          yaml: `name: test_callbacks_yaml
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing callback YAML generation`,
        },
      });

      // WHEN: We load and select the agent
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_callbacks_yaml' });
      await expect(agentNode).toBeVisible({ timeout: 10000 });
      await agentNode.click({ force: true });
      await page.waitForTimeout(500);

      // Scroll and add a before_model callback
      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      const callbacksSection = propertiesPanel.locator('[data-testid="callbacks-section"]');
      await callbacksSection.scrollIntoViewIfNeeded();
      await page.click('[data-testid="add-callback-button"]');
      await page.click('[data-testid="callback-type-before_model"]');
      await page.fill('[data-testid="callback-function-name-input"]', 'my_callbacks.security.validate_input');
      await page.click('[data-testid="add-callback-submit"]');

      // Wait for auto-save to complete (changes are saved automatically)
      await page.waitForTimeout(1500);

      // THEN: Check YAML content (page defaults to split view which shows YAML)
      // Use the YAML editor textarea which contains the raw YAML content
      const yamlEditor = page.locator('textarea').filter({ hasText: 'before_model_callbacks' });
      await expect(yamlEditor).toBeVisible({ timeout: 5000 });
      const yamlContent = await yamlEditor.inputValue();

      // Should have before_model_callbacks array
      expect(yamlContent).toContain('before_model_callbacks:');
      expect(yamlContent).toContain('name: my_callbacks.security.validate_input');

      // Cleanup
      await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_callbacks_yaml.yaml`);
    });

    test('Multiple callback types generate proper YAML structure', async ({ page }) => {
      // GIVEN: An LlmAgent exists
      await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
        data: {
          filename: 'test_callbacks_yaml_multi.yaml',
          yaml: `name: test_callbacks_yaml_multi
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing multiple callback YAML generation`,
        },
      });

      // WHEN: We load and select the agent
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_callbacks_yaml_multi' });
      await expect(agentNode).toBeVisible({ timeout: 10000 });
      await agentNode.click({ force: true });
      await page.waitForTimeout(500);

      // Scroll
      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      const callbacksSection = propertiesPanel.locator('[data-testid="callbacks-section"]');
      await callbacksSection.scrollIntoViewIfNeeded();

      // Add before_model callback
      await page.click('[data-testid="add-callback-button"]');
      await page.click('[data-testid="callback-type-before_model"]');
      await page.fill('[data-testid="callback-function-name-input"]', 'callbacks.validate');
      await page.click('[data-testid="add-callback-submit"]');

      // Add after_tool callback
      await page.click('[data-testid="add-callback-button"]');
      await page.click('[data-testid="callback-type-after_tool"]');
      await page.fill('[data-testid="callback-function-name-input"]', 'callbacks.log_result');
      await page.click('[data-testid="add-callback-submit"]');

      // Wait for auto-save to complete
      await page.waitForTimeout(1500);

      // THEN: Check YAML content (page defaults to split view which shows YAML)
      const yamlEditor = page.locator('textarea').filter({ hasText: 'before_model_callbacks' });
      await expect(yamlEditor).toBeVisible({ timeout: 5000 });
      const yamlContent = await yamlEditor.inputValue();

      // Should have both callback types
      expect(yamlContent).toContain('before_model_callbacks:');
      expect(yamlContent).toContain('name: callbacks.validate');
      expect(yamlContent).toContain('after_tool_callbacks:');
      expect(yamlContent).toContain('name: callbacks.log_result');

      // Cleanup
      await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_callbacks_yaml_multi.yaml`);
    });
  });

  test.describe('Story 10.5: Bidirectional Sync', () => {
    test('Existing callbacks in YAML load into UI', async ({ page }) => {
      // GIVEN: An agent with callbacks exists via API
      const yamlWithCallbacks = `name: test_agent_with_callbacks
agent_class: LlmAgent
model: gemini-2.5-flash
description: Test agent with callbacks
before_model_callbacks:
  - name: my_library.callbacks.validate_input
after_agent_callbacks:
  - name: my_library.callbacks.cleanup
`;

      await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
        data: { filename: 'test_agent_with_callbacks.yaml', yaml: yamlWithCallbacks },
      });

      // WHEN: We navigate to compose and select the agent
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      const testNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_agent_with_callbacks' });
      await expect(testNode).toBeVisible({ timeout: 10000 });
      await testNode.click({ force: true });
      await page.waitForTimeout(500);

      // Scroll to Callbacks section
      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      const callbacksSection = propertiesPanel.locator('[data-testid="callbacks-section"]');
      await callbacksSection.scrollIntoViewIfNeeded();

      // THEN: Should see both callbacks loaded (use callbacksSection to avoid matching YAML editor content)
      await expect(callbacksSection.locator('[data-testid="callback-card"]').filter({ hasText: 'Before Model' })).toBeVisible();
      await expect(callbacksSection.locator('text=my_library.callbacks.validate_input')).toBeVisible();
      await expect(callbacksSection.locator('[data-testid="callback-card"]').filter({ hasText: 'After Agent' })).toBeVisible();
      await expect(callbacksSection.locator('text=my_library.callbacks.cleanup')).toBeVisible();

      // Cleanup
      await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_agent_with_callbacks.yaml`);
    });
  });
});
