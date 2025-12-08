import { test, expect, TEST_PROJECT, restoreToolsFixtures } from './helpers';

test.describe.configure({ mode: 'serial' });

/**
 * Phase 9.4: OpenAPI Tools
 * - LlmAgent properties panel shows "OpenAPI Tools" section
 * - OpenAPI Tools section shows empty state when no APIs configured
 * - User can open Add OpenAPI dialog
 * - User can add an OpenAPI spec and it appears in YAML
 * - User can delete an OpenAPI spec
 * - Existing OpenAPI tool in YAML is displayed in UI
 */
test.describe('Phase 9.4: OpenAPI Tools', () => {
  test.beforeEach(async ({ page }) => {
    await restoreToolsFixtures(page.request);
  });

  // NOTE: All tests in this file are skipped due to React Flow timing issues when creating agents via API.
  // The OpenAPI Tools functionality is implemented and working - see OpenApiToolsSection.tsx
  // The UI flow works when tested manually, but E2E tests fail because the canvas doesn't
  // reliably re-render after API calls to create new agent files.
  test('LlmAgent can add OpenAPI Tools section via Add Tools dropdown', async ({ page }) => {
    // GIVEN: An LlmAgent exists in the project
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_openapi_tools.yaml',
        yaml: `name: test_openapi_tools
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing OpenAPI tools`,
      },
    });

    // WHEN: We load the compose page and select the agent
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Click on the agent node to select it
    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_openapi_tools' });
    await expect(agentNode).toBeVisible({ timeout: 10000 });
    await agentNode.click({ force: true });

    // Wait for click to register and properties panel to appear
    await page.waitForTimeout(500);

    // THEN: The properties panel should show and have an "Add Tools" dropdown
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible({ timeout: 15000 });

    // WHEN: We click Add Tools and select OpenAPI
    await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
    await expect(propertiesPanel.locator('[data-testid="add-tools-menu"]')).toBeVisible();
    await propertiesPanel.locator('[data-testid="add-tool-type-openapi"]').click();

    // THEN: The OpenAPI Tools section should appear
    const openApiSection = propertiesPanel.locator('[data-testid="openapi-tools-section"]');
    await expect(openApiSection).toBeVisible({ timeout: 10000 });

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_openapi_tools.yaml`);
  });

  test('OpenAPI Tools section shows empty state when no APIs configured', async ({ page }) => {
    // GIVEN: An LlmAgent exists without OpenAPI tools
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_openapi_tools.yaml',
        yaml: `name: test_openapi_tools
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing OpenAPI tools`,
      },
    });

    // WHEN: We load the compose page and select the agent
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_openapi_tools' });
    await agentNode.click({ force: true });

    // Add the OpenAPI section via Add Tools dropdown
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible({ timeout: 15000 });
    await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
    await propertiesPanel.locator('[data-testid="add-tool-type-openapi"]').click();

    // THEN: The OpenAPI section should show empty state
    const openApiSection = propertiesPanel.locator('[data-testid="openapi-tools-section"]');
    await expect(openApiSection).toBeVisible({ timeout: 10000 });

    const emptyState = openApiSection.locator('[data-testid="openapi-tools-empty-state"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('Add your first OpenAPI');

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_openapi_tools.yaml`);
  });

  test('user can open Add OpenAPI dialog', async ({ page }) => {
    // GIVEN: An LlmAgent exists
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_openapi_tools.yaml',
        yaml: `name: test_openapi_tools
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing OpenAPI tools`,
      },
    });

    // WHEN: We click the Add OpenAPI button
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_openapi_tools' });
    await agentNode.click({ force: true });

    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible({ timeout: 15000 });

    // First add the OpenAPI section via Add Tools dropdown
    await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
    await propertiesPanel.locator('[data-testid="add-tool-type-openapi"]').click();

    const openApiSection = propertiesPanel.locator('[data-testid="openapi-tools-section"]');
    await expect(openApiSection).toBeVisible({ timeout: 10000 });

    const addButton = openApiSection.locator('[data-testid="add-openapi-button"]');
    await expect(addButton).toBeVisible();
    await addButton.click({ force: true });

    // THEN: The Add OpenAPI dialog should appear
    const dialog = page.locator('[data-testid="add-openapi-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog has required fields
    await expect(dialog.locator('[data-testid="openapi-name-input"]')).toBeVisible();
    await expect(dialog.locator('[data-testid="openapi-spec-url-input"]')).toBeVisible();

    // Cleanup
    await dialog.locator('[data-testid="cancel-openapi-button"]').click();
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_openapi_tools.yaml`);
  });

  test('user can add an OpenAPI spec and it appears in YAML', async ({ page }) => {
    // GIVEN: An LlmAgent exists
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_openapi_tools.yaml',
        yaml: `name: test_openapi_tools
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing OpenAPI tools`,
      },
    });

    // WHEN: We add an OpenAPI spec
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_openapi_tools' });
    await agentNode.click({ force: true });

    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible({ timeout: 15000 });

    // First add the OpenAPI section via Add Tools dropdown
    await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
    await propertiesPanel.locator('[data-testid="add-tool-type-openapi"]').click();

    const openApiSection = propertiesPanel.locator('[data-testid="openapi-tools-section"]');
    await expect(openApiSection).toBeVisible({ timeout: 10000 });

    await openApiSection.locator('[data-testid="add-openapi-button"]').click({ force: true });

    const dialog = page.locator('[data-testid="add-openapi-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Fill in the form
    await dialog.locator('[data-testid="openapi-name-input"]').fill('petstore_api');
    await dialog.locator('[data-testid="openapi-spec-url-input"]').fill('https://petstore3.swagger.io/api/v3/openapi.json');

    // Save the OpenAPI config
    await dialog.locator('[data-testid="save-openapi-button"]').click();

    // Wait for dialog to close and YAML to update
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    // THEN: The OpenAPI spec should appear in YAML
    const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
    const data = await response.json();
    const agentFile = data.files.find((f: { filename: string }) => f.filename === 'test_openapi_tools.yaml');

    // Verify YAML contains OpenAPI reference
    expect(agentFile.yaml).toContain('OpenAPIToolset');
    expect(agentFile.yaml).toContain('petstore_api');

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_openapi_tools.yaml`);
  });

  test('user can delete an OpenAPI spec', async ({ page }) => {
    // GIVEN: An LlmAgent with an OpenAPI tool configured
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_openapi_tools.yaml',
        yaml: `name: test_openapi_tools
agent_class: LlmAgent
model: gemini-2.5-flash
description: Agent with OpenAPI tool
tools:
  - name: OpenAPIToolset
    args:
      name: petstore_api
      spec_url: https://petstore3.swagger.io/api/v3/openapi.json`,
      },
    });

    // WHEN: We delete the OpenAPI tool
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_openapi_tools' });
    await expect(agentNode).toBeVisible({ timeout: 10000 });
    await agentNode.click({ force: true });

    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible({ timeout: 10000 });

    const openApiSection = propertiesPanel.locator('[data-testid="openapi-tools-section"]');
    await openApiSection.scrollIntoViewIfNeeded();
    await expect(openApiSection).toBeVisible({ timeout: 5000 });

    // Click delete on the OpenAPI tool
    const openApiCard = openApiSection.locator('[data-testid="openapi-card-petstore_api"]');
    await expect(openApiCard).toBeVisible();
    await openApiCard.locator('[data-testid="delete-openapi-button"]').click();

    // Wait for YAML to update
    await page.waitForTimeout(500);

    // THEN: The OpenAPI tool should be removed from YAML
    const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
    const data = await response.json();
    const agentFile = data.files.find((f: { filename: string }) => f.filename === 'test_openapi_tools.yaml');

    expect(agentFile.yaml).not.toContain('OpenAPIToolset');
    expect(agentFile.yaml).not.toContain('petstore_api');

    // Empty state should be shown
    await expect(openApiSection.locator('[data-testid="openapi-tools-empty-state"]')).toBeVisible();

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_openapi_tools.yaml`);
  });

  test('existing OpenAPI tool in YAML is displayed in UI', async ({ page }) => {
    // GIVEN: An LlmAgent with OpenAPI tool already in YAML
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_openapi_tools.yaml',
        yaml: `name: test_openapi_tools
agent_class: LlmAgent
model: gemini-2.5-flash
description: Agent with OpenAPI tool
tools:
  - name: OpenAPIToolset
    args:
      name: github_api
      spec_url: https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json`,
      },
    });

    // WHEN: We load the compose page
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_openapi_tools' });
    await expect(agentNode).toBeVisible({ timeout: 10000 });
    await agentNode.click({ force: true });

    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible({ timeout: 10000 });

    const openApiSection = propertiesPanel.locator('[data-testid="openapi-tools-section"]');
    await openApiSection.scrollIntoViewIfNeeded();
    await expect(openApiSection).toBeVisible({ timeout: 5000 });

    // THEN: The existing OpenAPI tool should be displayed
    const openApiCard = openApiSection.locator('[data-testid="openapi-card-github_api"]');
    await expect(openApiCard).toBeVisible({ timeout: 10000 });

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_openapi_tools.yaml`);
  });
});
