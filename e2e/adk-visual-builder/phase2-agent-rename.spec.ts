/**
 * E2E Tests for ADK Visual Builder - Phase 2: Agent Rename
 *
 * Story 2.1: Rename agent updates filename
 * Story 2.2: Rename updates parent references
 */

import { test, expect } from '@playwright/test';
import { cleanupTestFiles, navigateToCompose, TEST_PROJECT } from './helpers';

test.describe.configure({ mode: 'serial' });

// ============================================================================
// Story 2.1: Rename Agent Updates Filename
// ============================================================================
test.describe.serial('ADK Visual Builder - Story 2.1: Rename Agent Updates Filename', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupTestFiles();
    await navigateToCompose(page);
  });

  test.afterEach(async () => {
    await cleanupTestFiles();
  });

  test('changing agent name in properties panel renames the YAML file', async ({ page }) => {
    const paletteItem = page.locator('[data-testid="palette-llm-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
    await page.waitForTimeout(500);

    const newNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'New Llm' });
    await expect(newNode).toBeVisible({ timeout: 5000 });

    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      const newFile = data.files.find((f: { filename: string }) => f.filename.startsWith('new_'));
      expect(newFile).toBeDefined();
    }).toPass({ timeout: 5000 });

    await newNode.click();
    await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible();

    const nameInput = page.locator('[data-testid="properties-panel"] input[placeholder="Agent name"]');
    await nameInput.clear();
    await nameInput.fill('Renamed Agent');
    await nameInput.blur();
    await page.waitForTimeout(500);

    await expect(async () => {
      const afterResponse = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const afterData = await afterResponse.json();
      const renamedFile = afterData.files.find((f: { filename: string }) =>
        f.filename === 'renamed_agent.yaml'
      );
      expect(renamedFile).toBeDefined();
    }).toPass({ timeout: 5000 });
  });

  test('old filename no longer exists after rename', async ({ page }) => {
    const paletteItem = page.locator('[data-testid="palette-llm-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });

    const newNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'New Llm' });
    await expect(newNode).toBeVisible({ timeout: 5000 });

    let originalFilename = '';
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      const newFile = data.files.find((f: { filename: string }) => f.filename.startsWith('new_'));
      expect(newFile).toBeDefined();
      originalFilename = newFile.filename;
    }).toPass({ timeout: 5000 });

    await newNode.click();
    await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible();
    const nameInput = page.locator('[data-testid="properties-panel"] input[placeholder="Agent name"]');
    await nameInput.clear();
    await nameInput.fill('Another Name');
    await nameInput.blur();

    await expect(async () => {
      const afterResponse = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const afterData = await afterResponse.json();
      const oldFile = afterData.files.find((f: { filename: string }) =>
        f.filename === originalFilename
      );
      expect(oldFile).toBeUndefined();
    }).toPass({ timeout: 5000 });
  });

  test('new filename matches new agent name in snake_case', async ({ page }) => {
    const paletteItem = page.locator('[data-testid="palette-llm-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });

    const newNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'New Llm' });
    await expect(newNode).toBeVisible({ timeout: 5000 });

    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      const newFile = data.files.find((f: { filename: string }) => f.filename.startsWith('new_'));
      expect(newFile).toBeDefined();
    }).toPass({ timeout: 5000 });

    await newNode.click();
    await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible();
    const nameInput = page.locator('[data-testid="properties-panel"] input[placeholder="Agent name"]');
    await nameInput.clear();
    await nameInput.fill('My Cool Agent Name');
    await nameInput.blur();

    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      const renamedFile = data.files.find((f: { filename: string }) =>
        f.filename === 'my_cool_agent_name.yaml'
      );
      expect(renamedFile).toBeDefined();
    }).toPass({ timeout: 5000 });
  });

  test('YAML content name field is updated after rename', async ({ page }) => {
    const paletteItem = page.locator('[data-testid="palette-llm-agent"]');
    const canvas = page.locator('[data-testid="agent-canvas"]');

    await paletteItem.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });

    // Wait for the newly created "New Llm" node to appear
    const newNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'New Llm' });
    await expect(newNode).toBeVisible({ timeout: 10000 });

    // Wait for file to be created
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      const newFile = data.files.find((f: { filename: string }) => f.filename.startsWith('new_'));
      expect(newFile).toBeDefined();
    }).toPass({ timeout: 10000 });

    await newNode.click();
    await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible();
    const nameInput = page.locator('[data-testid="properties-panel"] input[placeholder="Agent name"]');
    await nameInput.clear();
    await nameInput.fill('Updated Name');
    await nameInput.blur();

    // Rename is auto-saved on blur via PATCH API, wait for the file to be renamed
    let renamedFile: { filename: string; yaml: string } | undefined;
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      renamedFile = data.files.find((f: { filename: string }) =>
        f.filename === 'updated_name.yaml'
      );
      expect(renamedFile).toBeDefined();
    }).toPass({ timeout: 10000 });

    expect(renamedFile!.yaml).toContain('name: updated_name');
  });
});

// ============================================================================
// Story 2.2: Rename Updates Parent References
// ============================================================================
test.describe('ADK Visual Builder - Story 2.2: Rename Updates Parent References', () => {
  async function restoreFixtures(request: import('@playwright/test').APIRequestContext) {
    const filesResponse = await request.get(`/api/agents/${TEST_PROJECT}/files`);
    const data = await filesResponse.json();

    const rootAgentYaml = `name: marketing_team_lead
agent_class: LlmAgent
model: gemini-2.5-flash
description: The main agent responsible for orchestrating the social media marketing team.
sub_agents:
  - config_path: content_calendar_agent.yaml
  - config_path: copywriting_agent.yaml
  - config_path: scheduler_agent.yaml
`;
    await request.put(`/api/agents/${TEST_PROJECT}/files`, {
      headers: { 'Content-Type': 'application/json' },
      data: { filename: 'root_agent.yaml', yaml: rootAgentYaml },
    });

    const renamedFiles = data.files.filter((f: { filename: string }) =>
      !['root_agent.yaml', 'content_calendar_agent.yaml', 'copywriting_agent.yaml', 'scheduler_agent.yaml'].includes(f.filename)
    );
    for (const file of renamedFiles) {
      await request.delete(`/api/agents/${TEST_PROJECT}/files?filename=${file.filename}`);
    }

    if (!data.files.find((f: { filename: string }) => f.filename === 'content_calendar_agent.yaml')) {
      await request.put(`/api/agents/${TEST_PROJECT}/files`, {
        headers: { 'Content-Type': 'application/json' },
        data: {
          filename: 'content_calendar_agent.yaml',
          yaml: `name: content_calendar_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Responsible for creating the social media content calendar.
`
        },
      });
    }
    if (!data.files.find((f: { filename: string }) => f.filename === 'copywriting_agent.yaml')) {
      await request.put(`/api/agents/${TEST_PROJECT}/files`, {
        headers: { 'Content-Type': 'application/json' },
        data: {
          filename: 'copywriting_agent.yaml',
          yaml: `name: copywriting_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Responsible for writing copy for social media posts.
`
        },
      });
    }
  }

  test.beforeEach(async ({ page }) => {
    await restoreFixtures(page.request);
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ page }) => {
    await restoreFixtures(page.request);
  });

  test('renaming a sub-agent updates the parent config_path reference', async ({ page }) => {
    const initialRootResponse = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
    const initialData = await initialRootResponse.json();
    const initialRootFile = initialData.files.find((f: { filename: string }) => f.filename === 'root_agent.yaml');
    expect(initialRootFile.yaml).toContain('config_path: content_calendar_agent.yaml');

    const contentCalendarNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'content_calendar_agent' });
    await expect(contentCalendarNode).toBeVisible({ timeout: 5000 });
    await contentCalendarNode.click();

    await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible();
    const nameInput = page.locator('[data-testid="properties-panel"] input[placeholder="Agent name"]');
    await nameInput.clear();
    await nameInput.fill('calendar_manager');
    await nameInput.blur();

    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();

      const rootFile = data.files.find((f: { filename: string }) => f.filename === 'root_agent.yaml');
      expect(rootFile).toBeDefined();
      expect(rootFile.yaml).toContain('config_path: calendar_manager.yaml');
      expect(rootFile.yaml).not.toContain('config_path: content_calendar_agent.yaml');

      const renamedFile = data.files.find((f: { filename: string }) => f.filename === 'calendar_manager.yaml');
      expect(renamedFile).toBeDefined();
    }).toPass({ timeout: 10000 });
  });

  test('renaming preserves the parent-child relationship', async ({ page }) => {
    const contentCalendarNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'content_calendar_agent' });
    await expect(contentCalendarNode).toBeVisible({ timeout: 5000 });
    await contentCalendarNode.click();

    await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible();
    const nameInput = page.locator('[data-testid="properties-panel"] input[placeholder="Agent name"]');
    await nameInput.clear();
    await nameInput.fill('new_calendar');
    await nameInput.blur();

    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      const renamedFile = data.files.find((f: { filename: string }) => f.filename === 'new_calendar.yaml');
      expect(renamedFile).toBeDefined();
    }).toPass({ timeout: 5000 });

    const renamedNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'new_calendar' });
    await expect(renamedNode).toBeVisible();

    const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
    const data = await response.json();
    const rootFile = data.files.find((f: { filename: string }) => f.filename === 'root_agent.yaml');
    expect(rootFile.yaml).toContain('config_path: new_calendar.yaml');
  });

  test('renaming updates all parent references when agent has multiple parents', async ({ page }) => {
    const copywritingNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'copywriting_agent' });
    await expect(copywritingNode).toBeVisible({ timeout: 5000 });
    await copywritingNode.click();

    await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible();
    const nameInput = page.locator('[data-testid="properties-panel"] input[placeholder="Agent name"]');
    await nameInput.clear();
    await nameInput.fill('content_writer');
    await nameInput.blur();

    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();

      const renamedFile = data.files.find((f: { filename: string }) => f.filename === 'content_writer.yaml');
      expect(renamedFile).toBeDefined();

      const rootFile = data.files.find((f: { filename: string }) => f.filename === 'root_agent.yaml');
      expect(rootFile.yaml).toContain('config_path: content_writer.yaml');
      expect(rootFile.yaml).not.toContain('config_path: copywriting_agent.yaml');
    }).toPass({ timeout: 10000 });
  });

  test('renaming updates config_path references in tools section with AgentTool', async ({ page }) => {
    // Setup: Create a root agent with AgentTool reference
    const rootAgentWithToolsYaml = `name: marketing_team_lead
agent_class: LlmAgent
model: gemini-2.5-flash
description: Agent that uses AgentTool to call sub-agents
tools:
  - name: AgentTool
    args:
      agent:
        config_path: content_calendar_agent.yaml
sub_agents:
  - config_path: content_calendar_agent.yaml
`;
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      headers: { 'Content-Type': 'application/json' },
      data: { filename: 'root_agent.yaml', yaml: rootAgentWithToolsYaml },
    });

    // Reload the page to pick up the new structure
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

    // Find and rename the content_calendar_agent
    const contentCalendarNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'content_calendar_agent' });
    await expect(contentCalendarNode).toBeVisible({ timeout: 5000 });
    await contentCalendarNode.click();

    await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible();
    const nameInput = page.locator('[data-testid="properties-panel"] input[placeholder="Agent name"]');
    await nameInput.clear();
    await nameInput.fill('calendar_manager');
    await nameInput.blur();

    // Verify both tools and sub_agents sections are updated
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();

      const rootFile = data.files.find((f: { filename: string }) => f.filename === 'root_agent.yaml');
      expect(rootFile).toBeDefined();

      // Verify old reference is gone
      expect(rootFile.yaml).not.toContain('config_path: content_calendar_agent.yaml');

      // Verify new reference exists in BOTH tools and sub_agents sections
      const toolsMatch = rootFile.yaml.match(/tools:[\s\S]*?config_path: calendar_manager\.yaml/);
      expect(toolsMatch).toBeTruthy();

      const subAgentsMatch = rootFile.yaml.match(/sub_agents:[\s\S]*?config_path: calendar_manager\.yaml/);
      expect(subAgentsMatch).toBeTruthy();
    }).toPass({ timeout: 10000 });
  });
});
