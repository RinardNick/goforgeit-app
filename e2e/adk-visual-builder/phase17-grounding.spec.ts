/**
 * Phase 17: Built-in Tool Configuration
 *
 * Tests for configuring built-in tools with required parameters:
 * - Phase 17.1: VertexAiSearchTool (data_store_id, search_engine_id, filter, max_results)
 * - Phase 17.2: VertexAiRagRetrieval (rag_corpora, similarity_top_k, vector_distance_threshold)
 * - Phase 17.3: FilesRetrieval (input_dir)
 * - Phase 17.4: LongRunningFunctionTool (func)
 *
 * These tools require configuration beyond a simple toggle.
 */

import { test, expect } from '@playwright/test';
import { TEST_PROJECT } from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 17: Built-in Tool Configuration', () => {
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
    // Wait for fixture restoration to propagate to any caches
    await page.waitForTimeout(500);
  });

  test.afterEach(async ({ page }) => {
    await restoreFixtures(page.request);
  });

  test.describe('Story 17.1: VertexAiSearchTool Configuration', () => {
    test('VertexAiSearchTool shows data_store_id input when expanded', async ({ page }) => {
      // GIVEN: Navigate to compose page and select an agent
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      const rootAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
      await expect(rootAgent).toBeVisible({ timeout: 5000 });
      await rootAgent.click({ force: true });

      // WHEN: Add VertexAiSearchTool to the agent
      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await expect(propertiesPanel).toBeVisible({ timeout: 5000 });
      await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
      await expect(propertiesPanel.locator('[data-testid="add-tools-menu"]')).toBeVisible();
      await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();
      await propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]').click();

      // Select VertexAiSearchTool
      const modal = page.locator('[data-testid="builtin-tools-modal"]');
      await expect(modal).toBeVisible();
      await modal.locator('[data-testid="modal-tool-VertexAiSearchTool"]').click();
      await modal.locator('[data-testid="confirm-builtin-tools"]').click();

      // THEN: Expanding the tool card should show data_store_id input
      const toolCard = propertiesPanel.locator('[data-testid="tool-card-VertexAiSearchTool"]');
      await expect(toolCard).toBeVisible();
      await toolCard.click(); // Expand the card

      await expect(propertiesPanel.locator('[data-testid="vertex-data-store-id-input"]')).toBeVisible();
    });

    test('data_store_id input has correct placeholder text', async ({ page }) => {
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      const rootAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
      await rootAgent.click({ force: true });

      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
      await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();
      await propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]').click();

      const modal = page.locator('[data-testid="builtin-tools-modal"]');
      await modal.locator('[data-testid="modal-tool-VertexAiSearchTool"]').click();
      await modal.locator('[data-testid="confirm-builtin-tools"]').click();

      const toolCard = propertiesPanel.locator('[data-testid="tool-card-VertexAiSearchTool"]');
      await toolCard.click();

      // THEN: The input should have helpful placeholder
      const input = propertiesPanel.locator('[data-testid="vertex-data-store-id-input"]');
      await expect(input).toHaveAttribute('placeholder', /projects\/.*\/dataStores/);
    });

    test('can enter data_store_id value', async ({ page }) => {
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      const rootAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
      await rootAgent.click({ force: true });

      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
      await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();
      await propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]').click();

      const modal = page.locator('[data-testid="builtin-tools-modal"]');
      await modal.locator('[data-testid="modal-tool-VertexAiSearchTool"]').click();
      await modal.locator('[data-testid="confirm-builtin-tools"]').click();

      const toolCard = propertiesPanel.locator('[data-testid="tool-card-VertexAiSearchTool"]');
      await toolCard.click();

      // WHEN: Enter a data store ID
      const input = propertiesPanel.locator('[data-testid="vertex-data-store-id-input"]');
      const testDataStoreId = 'projects/my-project/locations/global/collections/default_collection/dataStores/my-datastore';
      await input.fill(testDataStoreId);

      // THEN: The value should be stored
      await expect(input).toHaveValue(testDataStoreId);
    });
  });

  test.describe('Story 17.2: YAML Generation with data_store_id', () => {
    test('YAML includes data_store_id in VertexAiSearchTool args', async ({ page }) => {
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      const rootAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
      await rootAgent.click({ force: true });

      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
      await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();
      await propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]').click();

      const modal = page.locator('[data-testid="builtin-tools-modal"]');
      await modal.locator('[data-testid="modal-tool-VertexAiSearchTool"]').click();
      await modal.locator('[data-testid="confirm-builtin-tools"]').click();

      const toolCard = propertiesPanel.locator('[data-testid="tool-card-VertexAiSearchTool"]');
      await toolCard.click();

      // Enter data store ID
      const input = propertiesPanel.locator('[data-testid="vertex-data-store-id-input"]');
      const testDataStoreId = 'projects/test-project/locations/global/collections/default_collection/dataStores/test-store';
      await input.fill(testDataStoreId);

      // Verify the input has the value (sanity check)
      await expect(input).toHaveValue(testDataStoreId);

      // Blur the input to trigger any onBlur handlers
      await input.blur();

      // Wait for React state to propagate (input onChange -> updateSelectedNodeData -> notifyChange -> nodesToYaml)
      await page.waitForTimeout(1000);

      // Switch to YAML view (use text selector since no data-testid)
      await page.locator('button:has-text("YAML")').click();

      // Wait a moment for YAML to render
      await page.waitForTimeout(1000);

      // THEN: YAML should contain the tool with args
      // The YAML editor is a textarea - use auto-waiting expect for reliability
      const yamlEditor = page.locator('textarea[spellcheck="false"]');
      await expect(yamlEditor).toBeVisible();

      // Use Playwright's auto-waiting toHaveValue with regex for more reliable assertion
      // This will automatically retry until the condition is met or timeout
      await expect(yamlEditor).toHaveValue(/data_store_id/, { timeout: 10000 });
      await expect(yamlEditor).toHaveValue(/test-store/);
      await expect(yamlEditor).toHaveValue(/VertexAiSearchTool/);
    });

    test('YAML omits args if data_store_id is empty', async ({ page }) => {
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      const rootAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
      await rootAgent.click({ force: true });

      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
      await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();
      await propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]').click();

      const modal = page.locator('[data-testid="builtin-tools-modal"]');
      await modal.locator('[data-testid="modal-tool-VertexAiSearchTool"]').click();
      await modal.locator('[data-testid="confirm-builtin-tools"]').click();

      // Don't enter any data store ID, switch to YAML view
      await page.locator('button:has-text("YAML")').click();

      // Wait a moment for YAML to render
      await page.waitForTimeout(1000);

      // THEN: YAML should have VertexAiSearchTool as simple string (no args)
      const yamlEditor = page.locator('textarea[spellcheck="false"]');
      await expect(yamlEditor).toBeVisible();
      const yamlContent = await yamlEditor.inputValue();
      expect(yamlContent).toContain('VertexAiSearchTool');
      // Should NOT contain args or data_store_id when empty
      expect(yamlContent).not.toMatch(/data_store_id:/);
    });
  });

  test.describe('Story 17.1.3: Bidirectional Sync', () => {
    test('existing data_store_id loads from YAML', async ({ page }) => {
      // GIVEN: Create an agent with VertexAiSearchTool and data_store_id
      const agentYaml = `name: grounding_test_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Test agent for grounding configuration
tools:
  - name: VertexAiSearchTool
    args:
      data_store_id: projects/existing-project/locations/global/collections/default_collection/dataStores/existing-store
`;
      await page.request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ filename: 'test_grounding_agent.yaml', yaml: agentYaml }),
      });

      // Navigate and select the agent
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      // Find and click the test agent node
      const testAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'grounding_test_agent' });
      await expect(testAgent).toBeVisible({ timeout: 5000 });
      await testAgent.click({ force: true });

      // Wait for the properties panel to show the correct agent is selected
      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await expect(propertiesPanel.getByPlaceholder('Agent name')).toHaveValue('grounding_test_agent', { timeout: 5000 });

      // WHEN: Expand the VertexAiSearchTool card
      const toolCard = propertiesPanel.locator('[data-testid="tool-card-VertexAiSearchTool"]');
      await expect(toolCard).toBeVisible({ timeout: 5000 });
      await toolCard.click();

      // THEN: The data_store_id should be pre-populated
      const input = propertiesPanel.locator('[data-testid="vertex-data-store-id-input"]');
      await expect(input).toHaveValue('projects/existing-project/locations/global/collections/default_collection/dataStores/existing-store');
    });
  });

  // ============================================================
  // Phase 17.2: VertexAiRagRetrieval Configuration
  // ============================================================
  test.describe('Phase 17.2: VertexAiRagRetrieval Configuration', () => {
    test('VertexAiRagRetrieval shows rag_corpora input when expanded', async ({ page }) => {
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      const rootAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
      await rootAgent.click({ force: true });

      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
      await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();
      await propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]').click();

      const modal = page.locator('[data-testid="builtin-tools-modal"]');
      await modal.locator('[data-testid="modal-tool-VertexAiRagRetrieval"]').click();
      await modal.locator('[data-testid="confirm-builtin-tools"]').click();

      const toolCard = propertiesPanel.locator('[data-testid="tool-card-VertexAiRagRetrieval"]');
      await expect(toolCard).toBeVisible();
      await toolCard.click();

      // THEN: Should show rag_corpora input
      await expect(propertiesPanel.locator('[data-testid="rag-corpora-input"]')).toBeVisible();
    });

    test('VertexAiRagRetrieval shows optional config fields', async ({ page }) => {
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      const rootAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
      await rootAgent.click({ force: true });

      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
      await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();
      await propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]').click();

      const modal = page.locator('[data-testid="builtin-tools-modal"]');
      await modal.locator('[data-testid="modal-tool-VertexAiRagRetrieval"]').click();
      await modal.locator('[data-testid="confirm-builtin-tools"]').click();

      const toolCard = propertiesPanel.locator('[data-testid="tool-card-VertexAiRagRetrieval"]');
      await toolCard.click();

      // THEN: Should show optional config fields
      await expect(propertiesPanel.locator('[data-testid="similarity-top-k-input"]')).toBeVisible();
      await expect(propertiesPanel.locator('[data-testid="vector-distance-threshold-input"]')).toBeVisible();
    });

    test('can configure VertexAiRagRetrieval and generate YAML', async ({ page }) => {
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      const rootAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
      await rootAgent.click({ force: true });

      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
      await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();
      await propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]').click();

      const modal = page.locator('[data-testid="builtin-tools-modal"]');
      await modal.locator('[data-testid="modal-tool-VertexAiRagRetrieval"]').click();
      await modal.locator('[data-testid="confirm-builtin-tools"]').click();

      const toolCard = propertiesPanel.locator('[data-testid="tool-card-VertexAiRagRetrieval"]');
      await toolCard.click();

      // Fill in configuration - just ragCorpora (match the pattern of the passing data_store_id test)
      const ragCorporaInput = propertiesPanel.locator('[data-testid="rag-corpora-input"]');
      await ragCorporaInput.fill('projects/my-project/locations/us-central1/ragCorpora/my-corpus');

      // Verify the input has the value
      await expect(ragCorporaInput).toHaveValue('projects/my-project/locations/us-central1/ragCorpora/my-corpus');

      // Blur to ensure state propagates
      await ragCorporaInput.blur();

      // Wait for React state to propagate (matching the passing test pattern)
      await page.waitForTimeout(1000);

      // Switch to YAML view
      await page.locator('button:has-text("YAML")').click();

      // Wait for YAML to render (matching the passing test pattern)
      await page.waitForTimeout(1000);

      const yamlEditor = page.locator('textarea[spellcheck="false"]');
      await expect(yamlEditor).toBeVisible();

      // Use Playwright's auto-waiting toHaveValue with regex for reliable assertion
      await expect(yamlEditor).toHaveValue(/rag_corpora/, { timeout: 15000 });
      await expect(yamlEditor).toHaveValue(/my-corpus/);
      await expect(yamlEditor).toHaveValue(/VertexAiRagRetrieval/);
    });

    test('existing VertexAiRagRetrieval config loads from YAML', async ({ page }) => {
      const agentYaml = `name: rag_test_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Test agent for RAG configuration
tools:
  - name: VertexAiRagRetrieval
    args:
      rag_corpora: projects/test-project/locations/us-central1/ragCorpora/test-corpus
      similarity_top_k: 10
      vector_distance_threshold: 0.8
`;
      await page.request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ filename: 'test_rag_agent.yaml', yaml: agentYaml }),
      });

      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      const testAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'rag_test_agent' });
      await expect(testAgent).toBeVisible({ timeout: 5000 });
      await testAgent.click({ force: true });

      // Wait for the properties panel to show the correct agent is selected
      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await expect(propertiesPanel.getByPlaceholder('Agent name')).toHaveValue('rag_test_agent', { timeout: 5000 });

      const toolCard = propertiesPanel.locator('[data-testid="tool-card-VertexAiRagRetrieval"]');
      await expect(toolCard).toBeVisible({ timeout: 5000 });
      await toolCard.click();

      await expect(propertiesPanel.locator('[data-testid="rag-corpora-input"]')).toHaveValue('projects/test-project/locations/us-central1/ragCorpora/test-corpus');
      await expect(propertiesPanel.locator('[data-testid="similarity-top-k-input"]')).toHaveValue('10');
      await expect(propertiesPanel.locator('[data-testid="vector-distance-threshold-input"]')).toHaveValue('0.8');
    });
  });

  // ============================================================
  // Phase 17.3: FilesRetrieval Configuration
  // ============================================================
  test.describe('Phase 17.3: FilesRetrieval Configuration', () => {
    test('FilesRetrieval shows input_dir field when expanded', async ({ page }) => {
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      const rootAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
      await rootAgent.click({ force: true });

      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
      await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();
      await propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]').click();

      const modal = page.locator('[data-testid="builtin-tools-modal"]');
      await modal.locator('[data-testid="modal-tool-FilesRetrieval"]').click();
      await modal.locator('[data-testid="confirm-builtin-tools"]').click();

      const toolCard = propertiesPanel.locator('[data-testid="tool-card-FilesRetrieval"]');
      await expect(toolCard).toBeVisible();
      await toolCard.click();

      await expect(propertiesPanel.locator('[data-testid="files-input-dir-input"]')).toBeVisible();
    });

    test('can configure FilesRetrieval and generate YAML', async ({ page }) => {
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      const rootAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
      await rootAgent.click({ force: true });

      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
      await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();
      await propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]').click();

      const modal = page.locator('[data-testid="builtin-tools-modal"]');
      await modal.locator('[data-testid="modal-tool-FilesRetrieval"]').click();
      await modal.locator('[data-testid="confirm-builtin-tools"]').click();

      const toolCard = propertiesPanel.locator('[data-testid="tool-card-FilesRetrieval"]');
      await toolCard.click();

      const inputDirInput = propertiesPanel.locator('[data-testid="files-input-dir-input"]');
      await inputDirInput.fill('./documents');
      await inputDirInput.blur();
      await page.waitForTimeout(1000);

      // Switch to YAML view
      await page.locator('button:has-text("YAML")').click();

      const yamlEditor = page.locator('textarea[spellcheck="false"]');
      await expect(yamlEditor).toBeVisible();

      // Use Playwright's auto-waiting toHaveValue with regex
      await expect(yamlEditor).toHaveValue(/input_dir/, { timeout: 10000 });
      await expect(yamlEditor).toHaveValue(/FilesRetrieval/);
      await expect(yamlEditor).toHaveValue(/\.\/documents/);
    });

    test('existing FilesRetrieval config loads from YAML', async ({ page }) => {
      const agentYaml = `name: files_test_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Test agent for FilesRetrieval configuration
tools:
  - name: FilesRetrieval
    args:
      input_dir: ./knowledge_base
`;
      await page.request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ filename: 'test_files_agent.yaml', yaml: agentYaml }),
      });

      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      const testAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'files_test_agent' });
      await expect(testAgent).toBeVisible({ timeout: 5000 });
      await testAgent.click({ force: true });

      // Wait for the properties panel to show the correct agent is selected
      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await expect(propertiesPanel.getByPlaceholder('Agent name')).toHaveValue('files_test_agent', { timeout: 5000 });

      const toolCard = propertiesPanel.locator('[data-testid="tool-card-FilesRetrieval"]');
      await expect(toolCard).toBeVisible({ timeout: 5000 });
      await toolCard.click();

      await expect(propertiesPanel.locator('[data-testid="files-input-dir-input"]')).toHaveValue('./knowledge_base');
    });
  });

  // ============================================================
  // Phase 17.4: LongRunningFunctionTool Configuration
  // ============================================================
  test.describe('Phase 17.4: LongRunningFunctionTool Configuration', () => {
    test('LongRunningFunctionTool shows func field when expanded', async ({ page }) => {
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      const rootAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
      await rootAgent.click({ force: true });

      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
      await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();
      await propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]').click();

      const modal = page.locator('[data-testid="builtin-tools-modal"]');
      await modal.locator('[data-testid="modal-tool-LongRunningFunctionTool"]').click();
      await modal.locator('[data-testid="confirm-builtin-tools"]').click();

      const toolCard = propertiesPanel.locator('[data-testid="tool-card-LongRunningFunctionTool"]');
      await expect(toolCard).toBeVisible();
      await toolCard.click();

      await expect(propertiesPanel.locator('[data-testid="long-running-func-input"]')).toBeVisible();
    });

    test('can configure LongRunningFunctionTool and generate YAML', async ({ page }) => {
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      const rootAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'marketing_team_lead' });
      await rootAgent.click({ force: true });

      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await propertiesPanel.locator('[data-testid="add-tools-btn"]').click();
      await propertiesPanel.locator('[data-testid="add-tool-type-builtin"]').click();
      await propertiesPanel.locator('[data-testid="add-builtin-tool-btn"]').click();

      const modal = page.locator('[data-testid="builtin-tools-modal"]');
      await modal.locator('[data-testid="modal-tool-LongRunningFunctionTool"]').click();
      await modal.locator('[data-testid="confirm-builtin-tools"]').click();

      const toolCard = propertiesPanel.locator('[data-testid="tool-card-LongRunningFunctionTool"]');
      await toolCard.click();

      const funcInput = propertiesPanel.locator('[data-testid="long-running-func-input"]');
      await funcInput.fill('my_module.async_process');
      await funcInput.blur();
      await page.waitForTimeout(1000);

      // Switch to YAML view
      await page.locator('button:has-text("YAML")').click();

      const yamlEditor = page.locator('textarea[spellcheck="false"]');
      await expect(yamlEditor).toBeVisible();

      // Use Playwright's auto-waiting toHaveValue with regex
      await expect(yamlEditor).toHaveValue(/func/, { timeout: 10000 });
      await expect(yamlEditor).toHaveValue(/LongRunningFunctionTool/);
      await expect(yamlEditor).toHaveValue(/my_module\.async_process/);
    });

    test('existing LongRunningFunctionTool config loads from YAML', async ({ page }) => {
      const agentYaml = `name: longrunning_test_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Test agent for LongRunningFunctionTool configuration
tools:
  - name: LongRunningFunctionTool
    args:
      func: tasks.long_running_task
`;
      await page.request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ filename: 'test_longrunning_agent.yaml', yaml: agentYaml }),
      });

      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      const testAgent = page.locator('[data-testid="agent-node"]').filter({ hasText: 'longrunning_test_agent' });
      await expect(testAgent).toBeVisible({ timeout: 5000 });
      await testAgent.click({ force: true });

      // Wait for the properties panel to show the correct agent is selected
      const propertiesPanel = page.locator('[data-testid="properties-panel"]');
      await expect(propertiesPanel.getByPlaceholder('Agent name')).toHaveValue('longrunning_test_agent', { timeout: 5000 });

      const toolCard = propertiesPanel.locator('[data-testid="tool-card-LongRunningFunctionTool"]');
      await expect(toolCard).toBeVisible({ timeout: 5000 });
      await toolCard.click();

      await expect(propertiesPanel.locator('[data-testid="long-running-func-input"]')).toHaveValue('tasks.long_running_task');
    });
  });
});
