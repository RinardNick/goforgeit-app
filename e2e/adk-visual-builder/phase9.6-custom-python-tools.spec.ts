/**
 * Phase 9.6: Custom Python Tools Tests
 *
 * Tests for creating, editing, and managing custom Python function tools
 * that can be used by ADK agents.
 *
 * ADK Function Tools Pattern:
 * - Python functions are passed directly to tools=[] without decorators
 * - Type hints define required vs optional parameters
 * - Docstrings become tool descriptions for the LLM
 * - Dictionary returns are preferred with a "status" field
 */

import { test, expect, TEST_PROJECT, restoreToolsFixtures, ADK_AGENTS_DIR } from './helpers';
import fs from 'fs/promises';
import path from 'path';

test.describe.configure({ mode: 'serial' });

// Helper to clean up test Python files
async function cleanupTestPythonFiles() {
  const toolsDir = path.join(ADK_AGENTS_DIR, TEST_PROJECT, 'tools');
  try {
    const files = await fs.readdir(toolsDir);
    for (const file of files) {
      if (file.startsWith('test_') && file.endsWith('.py')) {
        await fs.unlink(path.join(toolsDir, file));
      }
    }
  } catch {
    // Directory might not exist, that's ok
  }
}

test.describe('Phase 9.6: Custom Python Tools', () => {
  test.beforeEach(async ({ page }) => {
    await restoreToolsFixtures(page.request);
    await cleanupTestPythonFiles();
  });

  test.afterEach(async () => {
    await cleanupTestPythonFiles();
  });

  test.describe('Story 9.6.1: Custom Python Tools Panel UI', () => {
    // Skip these tests for now due to ReactFlow canvas click issues - the implementation is working
    test('LlmAgent properties panel shows Custom Python Tools section', async ({ page }) => {
      // GIVEN: Navigate to the compose page
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000); // Wait for canvas to settle

      // WHEN: Click on an LlmAgent node to open properties panel
      const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
      await expect(agentNode).toBeVisible({ timeout: 5000 });
      await agentNode.click({ force: true });
      await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible({ timeout: 5000 });

      // WHEN: Open the Add Tools dropdown and select Python Tools
      await page.click('[data-testid="add-tools-btn"]');
      await expect(page.locator('[data-testid="add-tools-menu"]')).toBeVisible();
      await page.click('[data-testid="add-tool-type-python"]');

      // THEN: Custom Python Tools section should be visible
      await expect(page.locator('[data-testid="custom-python-tools-section"]')).toBeVisible();
      await expect(page.locator('text=Custom Python Tools')).toBeVisible();
    });

    test('Custom Python Tools section shows empty state when no tools', async ({ page }) => {
      // GIVEN: Navigate to compose and select an agent
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
      await expect(agentNode).toBeVisible({ timeout: 5000 });
      await agentNode.click({ force: true });
      await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible({ timeout: 5000 });

      // Open Python tools section
      await page.click('[data-testid="add-tools-btn"]');
      await expect(page.locator('[data-testid="add-tools-menu"]')).toBeVisible();
      await page.click('[data-testid="add-tool-type-python"]');

      // THEN: Empty state should be shown
      await expect(page.locator('[data-testid="custom-python-tools-empty-state"]')).toBeVisible();
      await expect(page.locator('text=Create your first Python tool')).toBeVisible();
    });

    test('Add Python Tool button opens create dialog', async ({ page }) => {
      // GIVEN: Navigate to compose and select an agent
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      const agentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
      await expect(agentNode).toBeVisible({ timeout: 5000 });
      await agentNode.click({ force: true });
      await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible({ timeout: 5000 });

      // Open Python tools section
      await page.click('[data-testid="add-tools-btn"]');
      await expect(page.locator('[data-testid="add-tools-menu"]')).toBeVisible();
      await page.click('[data-testid="add-tool-type-python"]');

      // WHEN: Click the Add button
      await page.click('[data-testid="add-python-tool-btn"]');

      // THEN: Create dialog should open
      await expect(page.locator('[data-testid="create-python-tool-dialog"]')).toBeVisible();
    });
  });

  // NOTE: All tests in Story 9.6.2-9.6.6 are skipped due to React Flow timing issues when clicking agent nodes.
  // The Custom Python Tools functionality is implemented and working - see CustomPythonToolsPanel.tsx
  // The UI flow works when tested manually, but E2E tests fail because properties panel doesn't
  // reliably appear after clicking agent nodes due to canvas re-render timing.
  test.describe('Story 9.6.2: Create Python Tool Dialog', () => {
    test('Create dialog has Python code editor with Monaco', async ({ page }) => {
      // GIVEN: Open the create dialog
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="agent-node"]:has-text("marketing_team_lead")');
      await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible({ timeout: 5000 });
      await page.click('[data-testid="add-python-tool-btn"]');
      await expect(page.locator('[data-testid="create-python-tool-dialog"]')).toBeVisible();

      // THEN: Monaco editor should be visible
      await expect(page.locator('[data-testid="python-code-editor"]')).toBeVisible();
      // Monaco creates a specific container
      await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 5000 });
    });

    test('Create dialog shows template with docstring and type hints', async ({ page }) => {
      // GIVEN: Open the create dialog
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="agent-node"]:has-text("marketing_team_lead")');
      await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible({ timeout: 5000 });
      await page.click('[data-testid="add-python-tool-btn"]');
      await expect(page.locator('[data-testid="create-python-tool-dialog"]')).toBeVisible();

      // THEN: Editor should contain template code with docstring
      const editorContent = await page.locator('.monaco-editor').textContent();
      expect(editorContent).toContain('def');
      expect(editorContent).toContain('"""');
    });

    test('User can enter tool name', async ({ page }) => {
      // GIVEN: Open the create dialog
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="agent-node"]:has-text("marketing_team_lead")');
      await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible({ timeout: 5000 });
      await page.click('[data-testid="add-python-tool-btn"]');
      await expect(page.locator('[data-testid="create-python-tool-dialog"]')).toBeVisible();

      // WHEN: Enter a tool name
      await page.fill('[data-testid="python-tool-name-input"]', 'test_calculator');

      // THEN: The input should have the value
      await expect(page.locator('[data-testid="python-tool-name-input"]')).toHaveValue('test_calculator');
    });

    test('Create button saves Python tool file', async ({ page }) => {
      // GIVEN: Open create dialog and fill in details
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="agent-node"]:has-text("marketing_team_lead")');
      await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible({ timeout: 5000 });
      await page.click('[data-testid="add-python-tool-btn"]');
      await expect(page.locator('[data-testid="create-python-tool-dialog"]')).toBeVisible();

      // Enter tool name
      await page.fill('[data-testid="python-tool-name-input"]', 'test_add_numbers');

      // WHEN: Click create button
      await page.click('[data-testid="create-python-tool-button"]');

      // THEN: Dialog should close and tool should appear in list
      await expect(page.locator('[data-testid="create-python-tool-dialog"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="python-tool-card-test_add_numbers"]')).toBeVisible();
    });
  });

  test.describe('Story 9.6.3: Python Tool File Management', () => {
    test('Created Python tool file exists in project tools directory', async ({ page }) => {
      // GIVEN: Create a Python tool
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="agent-node"]:has-text("marketing_team_lead")');
      await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible({ timeout: 5000 });
      await page.click('[data-testid="add-python-tool-btn"]');
      await page.fill('[data-testid="python-tool-name-input"]', 'test_file_check');
      await page.click('[data-testid="create-python-tool-button"]');
      await expect(page.locator('[data-testid="python-tool-card-test_file_check"]')).toBeVisible();

      // THEN: Python file should exist
      const toolPath = path.join(ADK_AGENTS_DIR, TEST_PROJECT, 'tools', 'test_file_check.py');
      const fileExists = await fs.access(toolPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    test('Python tool card shows function signature', async ({ page }) => {
      // GIVEN: Create a Python tool via API first
      const toolCode = `def test_signature_tool(name: str, count: int = 5) -> dict:
    """A test tool that greets someone multiple times."""
    return {"status": "success", "greeting": f"Hello {name}!" * count}
`;
      await page.request.post(`/api/agents/${TEST_PROJECT}/tools`, {
        data: { name: 'test_signature_tool', code: toolCode },
      });

      // Navigate to compose
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="agent-node"]:has-text("marketing_team_lead")');
      await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible({ timeout: 5000 });

      // THEN: Tool card should show function signature
      const toolCard = page.locator('[data-testid="python-tool-card-test_signature_tool"]');
      await expect(toolCard).toBeVisible();
      await expect(toolCard.locator('text=name: str')).toBeVisible();
    });

    test('Delete button removes Python tool', async ({ page }) => {
      // GIVEN: A Python tool exists
      const toolCode = `def test_delete_me(value: str) -> dict:
    """A tool that will be deleted."""
    return {"status": "success", "value": value}
`;
      await page.request.post(`/api/agents/${TEST_PROJECT}/tools`, {
        data: { name: 'test_delete_me', code: toolCode },
      });

      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="agent-node"]:has-text("marketing_team_lead")');
      await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible({ timeout: 5000 });

      const toolCard = page.locator('[data-testid="python-tool-card-test_delete_me"]');
      await expect(toolCard).toBeVisible();

      // WHEN: Click delete button
      await toolCard.locator('[data-testid="delete-python-tool-button"]').click();

      // THEN: Tool should be removed
      await expect(toolCard).not.toBeVisible();
    });
  });

  test.describe('Story 9.6.4: Function Signature Extraction', () => {
    test('API extracts function parameters from Python code', async ({ page }) => {
      // GIVEN: Python code with typed parameters
      const toolCode = `def calculate_sum(a: int, b: int, precision: int = 2) -> dict:
    """Calculate the sum of two numbers.

    Args:
        a: First number
        b: Second number
        precision: Decimal precision (optional)
    """
    result = round(a + b, precision)
    return {"status": "success", "sum": result}
`;
      // WHEN: Create the tool via API
      const response = await page.request.post(`/api/agents/${TEST_PROJECT}/tools`, {
        data: { name: 'test_calculate_sum', code: toolCode },
      });

      // THEN: Response should include extracted signature
      expect(response.ok()).toBe(true);
      const data = await response.json();
      expect(data.signature).toBeDefined();
      expect(data.signature.name).toBe('calculate_sum');
      expect(data.signature.params).toContainEqual({ name: 'a', type: 'int', required: true });
      expect(data.signature.params).toContainEqual({ name: 'b', type: 'int', required: true });
      expect(data.signature.params).toContainEqual({ name: 'precision', type: 'int', required: false, default: '2' });
      expect(data.signature.docstring).toContain('Calculate the sum');
    });
  });

  test.describe('Story 9.6.5: Tool Testing', () => {
    test('Test Tool button opens test dialog', async ({ page }) => {
      // GIVEN: A Python tool exists
      const toolCode = `def test_echo(message: str) -> dict:
    """Echo back the message."""
    return {"status": "success", "echo": message}
`;
      await page.request.post(`/api/agents/${TEST_PROJECT}/tools`, {
        data: { name: 'test_echo', code: toolCode },
      });

      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="agent-node"]:has-text("marketing_team_lead")');
      await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible({ timeout: 5000 });

      const toolCard = page.locator('[data-testid="python-tool-card-test_echo"]');
      await expect(toolCard).toBeVisible();

      // WHEN: Click test button
      await toolCard.locator('[data-testid="test-python-tool-button"]').click();

      // THEN: Test dialog should open with parameter inputs
      await expect(page.locator('[data-testid="test-python-tool-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="test-param-message"]')).toBeVisible();
    });

    test('Running test shows result', async ({ page }) => {
      // GIVEN: A Python tool exists and test dialog is open
      const toolCode = `def test_greeter(name: str) -> dict:
    """Greet someone by name."""
    return {"status": "success", "greeting": f"Hello, {name}!"}
`;
      await page.request.post(`/api/agents/${TEST_PROJECT}/tools`, {
        data: { name: 'test_greeter', code: toolCode },
      });

      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="agent-node"]:has-text("marketing_team_lead")');
      await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible({ timeout: 5000 });

      const toolCard = page.locator('[data-testid="python-tool-card-test_greeter"]');
      await toolCard.locator('[data-testid="test-python-tool-button"]').click();
      await expect(page.locator('[data-testid="test-python-tool-dialog"]')).toBeVisible();

      // WHEN: Enter parameter and run test
      await page.fill('[data-testid="test-param-name"]', 'World');
      await page.click('[data-testid="run-tool-test-button"]');

      // THEN: Result should be displayed
      await expect(page.locator('[data-testid="tool-test-result"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="tool-test-result"]')).toContainText('Hello, World!');
    });
  });

  test.describe('Story 9.6.6: YAML Generation', () => {
    test('Adding Python tool updates YAML with function reference', async ({ page }) => {
      // GIVEN: Create a Python tool
      const toolCode = `def test_yaml_tool(query: str) -> dict:
    """Search for something."""
    return {"status": "success", "results": [query]}
`;
      await page.request.post(`/api/agents/${TEST_PROJECT}/tools`, {
        data: { name: 'test_yaml_tool', code: toolCode },
      });

      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="agent-node"]:has-text("marketing_team_lead")');
      await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible({ timeout: 5000 });

      // WHEN: Enable the Python tool for this agent
      const toolCard = page.locator('[data-testid="python-tool-card-test_yaml_tool"]');
      await expect(toolCard).toBeVisible();
      await toolCard.locator('[data-testid="enable-python-tool-checkbox"]').check();

      // Wait for YAML to update
      await page.waitForTimeout(500);

      // THEN: Check YAML contains the tool reference
      // Switch to YAML view
      await page.click('[data-testid="view-yaml-button"]');
      const yamlContent = await page.locator('[data-testid="yaml-editor"]').textContent();
      expect(yamlContent).toContain('test_yaml_tool');
    });

    test('Existing custom tool references load into UI', async ({ page }) => {
      // GIVEN: YAML with custom tool reference exists
      const yamlWithTool = `name: marketing_team_lead
agent_class: LlmAgent
model: gemini-2.5-flash
description: The main agent
tools:
  - ${TEST_PROJECT}.tools.test_existing_tool:my_function
`;
      await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
        data: { filename: 'root_agent.yaml', yaml: yamlWithTool },
      });

      // Also create the Python tool file
      const toolCode = `def my_function(param: str) -> dict:
    """An existing tool."""
    return {"status": "success"}
`;
      await page.request.post(`/api/agents/${TEST_PROJECT}/tools`, {
        data: { name: 'test_existing_tool', code: toolCode },
      });

      // WHEN: Navigate to compose
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="agent-node"]:has-text("marketing_team_lead")');
      await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible({ timeout: 5000 });

      // THEN: Tool should appear as enabled in the UI
      const toolCard = page.locator('[data-testid="python-tool-card-test_existing_tool"]');
      await expect(toolCard).toBeVisible();
      await expect(toolCard.locator('[data-testid="enable-python-tool-checkbox"]')).toBeChecked();
    });
  });
});
