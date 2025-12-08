import { test, expect, Page } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

export const ADK_AGENTS_DIR = path.join(process.cwd(), 'adk-service', 'agents');
export const TEST_PROJECT = 'marketing_team';

/**
 * Clean up test files from previous runs
 */
export async function cleanupTestFiles() {
  const testDir = path.join(ADK_AGENTS_DIR, TEST_PROJECT);
  const testFilePatterns = [
    /^new_.*\.yaml$/,
    /^renamed_.*\.yaml$/,
    /^updated_.*\.yaml$/,
    /^another_.*\.yaml$/,
    /^my_cool_agent_name\.yaml$/,
    /^\.yaml$/,
    /^test_.*\.yaml$/,
  ];

  try {
    const files = await fs.readdir(testDir);
    for (const file of files) {
      if (testFilePatterns.some(pattern => pattern.test(file))) {
        await fs.unlink(path.join(testDir, file));
      }
    }
  } catch {
    // Directory might not exist, that's ok
  }
}

/**
 * Check if a file exists in the test project directory
 */
export async function fileExistsInProject(filename: string): Promise<boolean> {
  try {
    await fs.access(path.join(ADK_AGENTS_DIR, TEST_PROJECT, filename));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a YAML file from the test project directory
 */
export async function readYamlFile(filename: string): Promise<string> {
  return fs.readFile(path.join(ADK_AGENTS_DIR, TEST_PROJECT, filename), 'utf-8');
}

/**
 * Navigate to the compose page and wait for it to load
 */
export async function navigateToCompose(page: Page) {
  await page.goto(`/${TEST_PROJECT}/compose`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-testid="agent-composer"]')).toBeVisible({ timeout: 15000 });
}

/**
 * Navigate to the compose page and wait for the canvas to be ready
 */
export async function navigateToComposeWithCanvas(page: Page) {
  await page.goto(`/${TEST_PROJECT}/compose`);
  await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1000);
}

/**
 * Drag an agent type from the palette onto the canvas
 */
export async function dragAgentToCanvas(page: Page, agentType: string) {
  const paletteItem = page.locator(`[data-testid="palette-${agentType}"]`);
  const canvas = page.locator('[data-testid="agent-canvas"]');

  await paletteItem.dragTo(canvas);
  await page.waitForTimeout(500);
}

/**
 * Create a test agent file via API
 */
export async function createTestAgent(
  page: Page,
  filename: string,
  yaml: string
) {
  await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
    data: { filename, yaml },
  });
}

/**
 * Delete a test agent file via API
 */
export async function deleteTestAgent(page: Page, filename: string) {
  await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=${filename}`);
}

/**
 * Simulate drag and drop with proper HTML5 dataTransfer
 * Playwright's dragTo() doesn't properly simulate dataTransfer for HTML5 drag events
 */
export async function simulateDragDrop(
  page: Page,
  sourceLocator: ReturnType<Page['locator']>,
  targetLocator: ReturnType<Page['locator']>,
  nodeId: string
) {
  const sourceHandle = await sourceLocator.elementHandle();
  const targetHandle = await targetLocator.elementHandle();

  await page.evaluate(({ source, target, nodeId }) => {
    if (!source || !target) return;

    const dataTransferData: Record<string, string> = {};
    const dataTransfer = {
      setData: (type: string, data: string) => { dataTransferData[type] = data; },
      getData: (type: string) => dataTransferData[type] || '',
      effectAllowed: 'move',
      dropEffect: 'move',
    };

    const dragStartEvent = new DragEvent('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragStartEvent, 'dataTransfer', { value: dataTransfer });
    dataTransfer.setData('application/reactflow/nodeId', nodeId);
    source.dispatchEvent(dragStartEvent);

    const dragOverEvent = new DragEvent('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer });
    target.dispatchEvent(dragOverEvent);

    const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });
    target.dispatchEvent(dropEvent);
  }, { source: sourceHandle, target: targetHandle, nodeId });
}

/**
 * Get the React Flow node ID from an agent node element
 */
export async function getNodeId(agentNode: ReturnType<Page['locator']>): Promise<string> {
  return await agentNode.evaluate((el) => {
    const nodeWrapper = el.closest('.react-flow__node');
    return nodeWrapper?.getAttribute('data-id') || '';
  });
}

/**
 * Helper to restore fixture files for tools panel tests
 */
export async function restoreToolsFixtures(request: { fetch: (url: string, options?: unknown) => Promise<{ json: () => Promise<{ files: Array<{ filename: string }> }> }> }) {
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

// Re-export test and expect for convenience
export { test, expect };
