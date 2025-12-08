import { test, expect } from '@playwright/test';
import { TEST_PROJECT } from './helpers';

test.describe.configure({ mode: 'serial' });

/**
 * Phase 9.1: Built-in Tools Panel
 * - LlmAgent properties panel shows "Built-in Tools" section with Add button
 * - User can open modal to select built-in tools
 * - Selected tools appear as pills
 * - Pills can be removed to delete tools
 * - Tools are written to YAML correctly
 */
test.describe('ADK Visual Builder - Phase 9.1: Built-in Tools Panel', () => {
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

  // NOTE: This test is redundant with 'clicking Add opens modal' test below which covers the same flow end-to-end
  // Skipped due to timing issue with newly created agent nodes
  test('LlmAgent properties panel shows Add Tools dropdown and can add Built-in Tools section', async ({ page }) => {
    // GIVEN: An LlmAgent exists in the project
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_llm_tools.yaml',
        yaml: `name: test_llm_tools
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing tools`,
      },
    });

    // WHEN: We load the compose page and select the agent
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Click on the agent node to select it
    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_llm_tools' });
    await expect(agentNode).toBeVisible({ timeout: 5000 });
    await agentNode.click({ force: true });

    // THEN: The properties panel should show an "Add Tools" dropdown
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible({ timeout: 5000 });
    await expect(propertiesPanel.locator('[data-testid="add-tools-btn"]')).toBeVisible();

    // WHEN: We click Add Tools and select Built-in Tools
    await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
    await expect(propertiesPanel.locator('[data-testid="add-tools-menu"]')).toBeVisible();
    await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();

    // THEN: The Built-in Tools section should appear with Add button
    await expect(propertiesPanel.locator('[data-testid="builtin-tools-section"]')).toBeVisible();
    await expect(propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]')).toBeVisible();

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_llm_tools.yaml`);
  });

  // NOTE: Tests below are skipped due to React Flow timing issues when creating agents via API.
  // The functionality is implemented and working - see AddToolsDropdown.tsx, BuiltinToolsSection.tsx
  // The UI flow works when tested manually, but E2E tests fail because the canvas doesn't
  // reliably re-render after API calls to create new agent files.
  test('clicking Add opens modal with google_search and other tools', async ({ page }) => {
    // GIVEN: An LlmAgent exists
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_llm_tools.yaml',
        yaml: `name: test_llm_tools
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing tools`,
      },
    });

    // WHEN: We load the compose page and select the agent
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_llm_tools' });
    await agentNode.click({ force: true });

    // First expand the Built-in Tools section via Add Tools dropdown
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible({ timeout: 5000 });
    await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
    await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();
    await expect(propertiesPanel.locator('[data-testid="builtin-tools-section"]')).toBeVisible();

    // Click Add button to open the built-in tools modal
    await propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]').click();

    // THEN: Modal should be visible with google_search option
    const modal = page.locator('[data-testid="builtin-tools-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('[data-testid="modal-tool-google_search"]')).toBeVisible();
    await expect(modal.locator('text=Web search using Google')).toBeVisible();
    await expect(modal.locator('[data-testid="modal-tool-built_in_code_execution"]')).toBeVisible();
    await expect(modal.locator('text=Python code execution')).toBeVisible();

    // Close modal
    await modal.locator('[data-testid="confirm-builtin-tools"]').click();

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_llm_tools.yaml`);
  });

  test('selecting google_search in modal adds it as pill and to YAML', async ({ page }) => {
    // GIVEN: An LlmAgent exists without any tools
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_llm_tools.yaml',
        yaml: `name: test_llm_tools
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing tools`,
      },
    });

    // Load the compose page and select the agent
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_llm_tools' });
    await agentNode.click({ force: true });

    // First expand the Built-in Tools section via Add Tools dropdown
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible({ timeout: 5000 });
    await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
    await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();
    await expect(propertiesPanel.locator('[data-testid="builtin-tools-section"]')).toBeVisible();

    // WHEN: We open modal and select google_search
    await propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]').click();

    const modal = page.locator('[data-testid="builtin-tools-modal"]');
    await expect(modal).toBeVisible();

    // Click to select google_search
    await modal.locator('[data-testid="modal-tool-google_search"]').click();
    await modal.locator('[data-testid="confirm-builtin-tools"]').click();

    // Wait for the YAML to be updated
    await page.waitForTimeout(500);

    // THEN: google_search pill should appear
    await expect(propertiesPanel.locator('[data-testid="tool-pill-google_search"]')).toBeVisible();

    // AND: The YAML file should contain google_search in the tools array
    const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
    const data = await response.json();

    const agentFile = data.files.find((f: { filename: string }) => f.filename === 'test_llm_tools.yaml');
    expect(agentFile).toBeDefined();
    expect(agentFile.yaml).toContain('tools:');
    expect(agentFile.yaml).toContain('google_search');

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_llm_tools.yaml`);
  });

  test('removing google_search pill removes it from the YAML tools array', async ({ page }) => {
    // GIVEN: An LlmAgent exists WITH google_search tool
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_llm_tools.yaml',
        yaml: `name: test_llm_tools
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing tools
tools:
  - google_search`,
      },
    });

    // Load the compose page and select the agent
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_llm_tools' });
    await agentNode.click({ force: true });

    // WHEN: We remove the google_search pill by clicking its X button
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible();

    // Should see google_search pill
    const pill = propertiesPanel.locator('[data-testid="tool-pill-google_search"]');
    await expect(pill).toBeVisible();

    // Click remove button on pill
    await propertiesPanel.locator('[data-testid="remove-tool-google_search"]').click();

    // Wait for the YAML to be updated
    await page.waitForTimeout(500);

    // THEN: The pill should be gone
    await expect(pill).not.toBeVisible();

    // AND: The YAML file should NOT contain google_search anymore
    const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
    const data = await response.json();

    const agentFile = data.files.find((f: { filename: string }) => f.filename === 'test_llm_tools.yaml');
    expect(agentFile).toBeDefined();
    expect(agentFile.yaml).not.toContain('google_search');

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_llm_tools.yaml`);
  });

  test('existing tools in YAML appear as pills', async ({ page }) => {
    // GIVEN: An LlmAgent exists WITH google_search but NOT built_in_code_execution
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_llm_tools.yaml',
        yaml: `name: test_llm_tools
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing tools
tools:
  - google_search`,
      },
    });

    // WHEN: We load the compose page and select the agent
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_llm_tools' });
    await agentNode.click({ force: true });

    // THEN: google_search pill should be visible, built_in_code_execution should NOT
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible();

    await expect(propertiesPanel.locator('[data-testid="tool-pill-google_search"]')).toBeVisible();
    await expect(propertiesPanel.locator('[data-testid="tool-pill-built_in_code_execution"]')).not.toBeVisible();

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_llm_tools.yaml`);
  });

  test('tools are saved in ADK-compliant format (simple strings for unconfigured tools)', async ({ page }) => {
    // GIVEN: An LlmAgent exists without any tools
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_tool_format.yaml',
        yaml: `name: test_tool_format
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing tool format`,
      },
    });

    // Load the compose page and select the agent
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_tool_format' });
    await agentNode.click({ force: true });

    // Expand the Built-in Tools section
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible({ timeout: 5000 });
    await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
    await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();
    await expect(propertiesPanel.locator('[data-testid="builtin-tools-section"]')).toBeVisible();

    // WHEN: We add google_search and built_in_code_execution tools via the modal
    await propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]').click();

    const modal = page.locator('[data-testid="builtin-tools-modal"]');
    await expect(modal).toBeVisible();

    // Select both tools
    await modal.locator('[data-testid="modal-tool-google_search"]').click();
    await modal.locator('[data-testid="modal-tool-built_in_code_execution"]').click();
    await modal.locator('[data-testid="confirm-builtin-tools"]').click();

    // Wait for the YAML to be updated
    await page.waitForTimeout(500);

    // THEN: The YAML file should contain tools as simple strings
    const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
    const data = await response.json();

    const agentFile = data.files.find((f: { filename: string }) => f.filename === 'test_tool_format.yaml');
    expect(agentFile).toBeDefined();

    // CRITICAL: Tools should be simple strings if unconfigured
    expect(agentFile.yaml).toContain('  - google_search');
    expect(agentFile.yaml).toContain('  - built_in_code_execution');

    // Verify object format is NOT used for these
    expect(agentFile.yaml).not.toContain('name: google_search');
    expect(agentFile.yaml).not.toContain('name: built_in_code_execution');

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_tool_format.yaml`);
  });
});

/**
 * Phase 9.2: MCP Tools Panel
 * - LlmAgent properties panel shows "MCP Tools" section
 * - User can add an MCP server (Local/Stdio)
 * - User can add an MCP server (Remote/SSE)
 * - Added server appears in the server list
 * - User can delete an MCP server
 * - MCP tools are written to YAML correctly (MCPToolset format)
 */
test.describe('ADK Visual Builder - Phase 9.2: MCP Tools Panel', () => {
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

  // NOTE: Tests below are skipped due to React Flow timing issues when creating agents via API.
  // The functionality is implemented and working - see McpToolsSection.tsx
  test('LlmAgent can add MCP Tools section via Add Tools dropdown', async ({ page }) => {
    // GIVEN: An LlmAgent exists (without MCP tools configured)
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_mcp_agent.yaml',
        yaml: `name: test_mcp_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing MCP`,
      },
    });

    // WHEN: We load the compose page and select the agent
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_mcp_agent' });
    await agentNode.click({ force: true });

    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible({ timeout: 5000 });

    // MCP section should NOT be visible initially (no MCP tools configured)
    await expect(propertiesPanel.locator('[data-testid="mcp-tools-section"]')).not.toBeVisible();

    // WHEN: We click Add Tools and select MCP
    await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
    await expect(propertiesPanel.locator('[data-testid="add-tools-menu"]')).toBeVisible();
    await propertiesPanel.locator('[data-testid="add-tool-type-mcp"]').click();

    // THEN: The properties panel should show an "MCP Tools" section
    await expect(propertiesPanel.locator('[data-testid="mcp-tools-section"]')).toBeVisible({ timeout: 5000 });

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_mcp_agent.yaml`);
  });

  test('user can add MCP server and it appears in list', async ({ page }) => {
    // GIVEN: An LlmAgent exists
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_mcp_agent.yaml',
        yaml: `name: test_mcp_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing MCP`,
      },
    });

    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_mcp_agent' });
    await agentNode.click({ force: true });

    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible({ timeout: 5000 });

    // First, expand MCP section via Add Tools dropdown
    await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
    await propertiesPanel.locator('[data-testid="add-tool-type-mcp"]').click();
    await expect(propertiesPanel.locator('[data-testid="mcp-tools-section"]')).toBeVisible({ timeout: 5000 });

    // WHEN: We add an MCP server - Click add server button
    await propertiesPanel.locator('[data-testid="add-mcp-server-button"]').click();

    // Fill in server details (Stdio type)
    const dialog = page.locator('[data-testid="add-mcp-server-dialog"]');
    await expect(dialog).toBeVisible();

    await dialog.locator('[data-testid="mcp-server-name-input"]').fill('test-server');
    await dialog.locator('[data-testid="mcp-stdio-command-input"]').fill('npx');

    // Save
    await dialog.locator('[data-testid="mcp-server-save-button"]').click();

    // THEN: Server should appear in the list
    await expect(propertiesPanel.locator('text=test-server')).toBeVisible({ timeout: 5000 });

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_mcp_agent.yaml`);
  });
});

/**
 * Phase 9.3: Agent Tools Panel
 * - LlmAgent properties panel shows "Agent Tools" section
 * - User can add another agent as a tool
 * - Added agent tool appears in the list
 * - User can delete an agent tool
 * - Agent tools are written to YAML correctly (AgentTool format)
 */
test.describe('ADK Visual Builder - Phase 9.3: Agent Tools Panel', () => {
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

  // NOTE: Tests below are skipped due to React Flow timing issues when creating agents via API.
  // The functionality is implemented and working - see AgentToolsSection.tsx
  test('LlmAgent can add Agent Tools section via Add Tools dropdown', async ({ page }) => {
    // GIVEN: An LlmAgent exists (without agent tools configured)
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_agent_tools.yaml',
        yaml: `name: test_agent_tools
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing agent tools`,
      },
    });

    // WHEN: We load the compose page and select the agent
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_agent_tools' });
    await agentNode.click({ force: true });

    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible({ timeout: 5000 });

    // Agent Tools section should NOT be visible initially (no agent tools configured)
    await expect(propertiesPanel.locator('[data-testid="agent-tools-section"]')).not.toBeVisible();

    // WHEN: We click Add Tools and select Agent
    await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
    await expect(propertiesPanel.locator('[data-testid="add-tools-menu"]')).toBeVisible();
    await propertiesPanel.locator('[data-testid="add-tool-type-agent"]').click();

    // THEN: The properties panel should show an "Agent Tools" section
    await expect(propertiesPanel.locator('[data-testid="agent-tools-section"]')).toBeVisible({ timeout: 5000 });

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_agent_tools.yaml`);
  });
});

/**
 * Phase 9.4: OpenAPI Tools Panel
 * - LlmAgent properties panel shows "OpenAPI Tools" section
 * - User can add an OpenAPI specification
 * - Added OpenAPI tool appears in the list
 * - User can delete an OpenAPI tool
 * - OpenAPI tools are written to YAML correctly
 */
test.describe('ADK Visual Builder - Phase 9.4: OpenAPI Tools Panel', () => {
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

  // NOTE: Tests below are skipped due to React Flow timing issues when creating agents via API.
  // The functionality is implemented and working - see OpenApiToolsSection.tsx
  test('LlmAgent can add OpenAPI Tools section via Add Tools dropdown', async ({ page }) => {
    // GIVEN: An LlmAgent exists (without OpenAPI tools configured)
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_openapi_agent.yaml',
        yaml: `name: test_openapi_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: An agent for testing OpenAPI tools`,
      },
    });

    // WHEN: We load the compose page and select the agent
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_openapi_agent' });
    await agentNode.click({ force: true });

    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible({ timeout: 5000 });

    // OpenAPI Tools section should NOT be visible initially (no OpenAPI tools configured)
    await expect(propertiesPanel.locator('[data-testid="openapi-tools-section"]')).not.toBeVisible();

    // WHEN: We click Add Tools and select OpenAPI
    await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
    await expect(propertiesPanel.locator('[data-testid="add-tools-menu"]')).toBeVisible();
    await propertiesPanel.locator('[data-testid="add-tool-type-openapi"]').click();

    // THEN: The properties panel should show an "OpenAPI Tools" section
    await expect(propertiesPanel.locator('[data-testid="openapi-tools-section"]')).toBeVisible({ timeout: 5000 });

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_openapi_agent.yaml`);
  });
});

/**
 * Phase 9.3.5: AgentTool Navigation (Click to Edit)
 * - User can click on an AgentTool card to navigate to that agent
 * - Clicking opens a new editor view for the tool agent
 * - User sees a back button to return to the parent agent
 * - User sees context indicating this is a tool agent of the parent
 */
test.describe('ADK Visual Builder - Phase 9.3.5: AgentTool Navigation', () => {
  async function restoreFixtures(request: { fetch: Function }) {
    // Create parent agent with an AgentTool
    const parentAgentYaml = `name: parent_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Parent agent that uses a tool agent
sub_agents: []
tools:
  - name: AgentTool
    args:
      agent:
        config_path: ./tool_agent.yaml
      skip_summarization: false
`;
    await request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ filename: 'parent_agent.yaml', yaml: parentAgentYaml }),
    });

    // Create the tool agent
    const toolAgentYaml = `name: tool_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: A specialized agent used as a tool
sub_agents: []
tools: []
`;
    await request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ filename: 'tool_agent.yaml', yaml: toolAgentYaml }),
    });

    // Set parent as root
    const rootAgentYaml = `name: marketing_team_lead
agent_class: LlmAgent
model: gemini-2.5-flash
description: The main agent
sub_agents:
  - config_path: ./parent_agent.yaml
`;
    await request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ filename: 'root_agent.yaml', yaml: rootAgentYaml }),
    });
  }

  test.beforeEach(async ({ page }) => {
    await restoreFixtures(page.request);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup test files
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=parent_agent.yaml`);
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=tool_agent.yaml`);
  });

  test('User can click AgentTool card to navigate to tool agent editor', async ({ page }) => {
    // GIVEN: Compose page is loaded with parent agent that has an AgentTool
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

    // Select the parent agent
    const parentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'parent_agent' });
    await expect(parentNode).toBeVisible({ timeout: 5000 });
    await parentNode.click({ force: true });

    // Verify AgentTool card is visible in properties panel
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible();
    const agentToolCard = propertiesPanel.locator('[data-testid="agent-tool-card-tool_agent"]');
    await expect(agentToolCard).toBeVisible({ timeout: 5000 });

    // WHEN: User clicks on the AgentTool card
    await agentToolCard.click();

    // THEN: UI should navigate to the tool agent's editor view
    // Check for navigation context (breadcrumb or back button)
    await expect(page.locator('[data-testid="agent-tool-context"]')).toBeVisible({ timeout: 5000 });

    // Check for back button
    await expect(page.locator('[data-testid="back-to-parent-button"]')).toBeVisible();

    // Check that the properties panel now shows the tool_agent details
    await expect(propertiesPanel.locator('text=tool_agent')).toBeVisible();

    // Check for context indicator showing this is a tool agent
    await expect(page.locator('[data-testid="tool-agent-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="tool-agent-indicator"]')).toContainText('Tool Agent of: parent_agent');
  });

  test('User can navigate back from tool agent editor to parent', async ({ page }) => {
    // GIVEN: User has navigated to a tool agent's editor
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

    const parentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'parent_agent' });
    await parentNode.click({ force: true });

    const agentToolCard = page.locator('[data-testid="agent-tool-card-tool_agent"]');
    await agentToolCard.click();

    await expect(page.locator('[data-testid="back-to-parent-button"]')).toBeVisible({ timeout: 5000 });

    // WHEN: User clicks the back button
    await page.locator('[data-testid="back-to-parent-button"]').click();

    // THEN: UI should navigate back to the parent agent view
    await expect(page.locator('[data-testid="agent-tool-context"]')).not.toBeVisible({ timeout: 5000 });

    // Parent agent should be selected again
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel.locator('text=parent_agent')).toBeVisible();

    // AgentTool card should be visible again
    await expect(page.locator('[data-testid="agent-tool-card-tool_agent"]')).toBeVisible();
  });
});
