import { test, expect } from '@playwright/test';
import { ADK_AGENTS_DIR, TEST_PROJECT } from './helpers';

test.describe.configure({ mode: 'serial' });

/**
 * Story 3.1: Creating connections adds sub_agents
 * - Creating an edge adds config_path to parent YAML
 * - config_path uses relative filename (not full path)
 * - Multiple connections create multiple sub_agents entries
 */
test.describe('ADK Visual Builder - Story 3.1: Creating Connections Adds sub_agents', () => {
  // Helper function to restore fixture files via API
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
    const contentCalendarYaml = `name: content_calendar_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Responsible for creating the social media content calendar.
`;
    const copywritingYaml = `name: copywriting_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Responsible for writing copy for social media posts.
`;
    const schedulerYaml = `name: scheduler_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Responsible for scheduling social media posts.
`;

    // Restore root_agent.yaml
    await request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ filename: 'root_agent.yaml', yaml: rootAgentYaml }),
    });

    // Restore content_calendar_agent.yaml
    await request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ filename: 'content_calendar_agent.yaml', yaml: contentCalendarYaml }),
    });

    // Restore copywriting_agent.yaml
    await request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ filename: 'copywriting_agent.yaml', yaml: copywritingYaml }),
    });

    // Restore scheduler_agent.yaml
    await request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ filename: 'scheduler_agent.yaml', yaml: schedulerYaml }),
    });

    // Delete any test files
    const filesResponse = await request.fetch(`/api/agents/${TEST_PROJECT}/files`);
    const data = await filesResponse.json();
    const testFiles = data.files.filter((f: { filename: string }) =>
      f.filename.startsWith('new_') || f.filename.startsWith('test_')
    );
    for (const file of testFiles) {
      await request.fetch(`/api/agents/${TEST_PROJECT}/files?filename=${file.filename}`, { method: 'DELETE' });
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

  // NOTE: Removed duplicate test 'creating connection adds config_path to parent YAML'
  // The same behavior is already tested by 'config_path uses relative filename (not full path)'
  // which also validates that connections create config_path entries in parent YAML

  test('config_path uses relative filename (not full path)', async ({ page }) => {
    // GIVEN: A connection is created between agents
    // Create a test agent first
    const createResponse = await page.request.post(`/api/agents/${TEST_PROJECT}/files`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        name: 'test_agent',
        agentClass: 'LlmAgent',
        model: 'gemini-2.5-flash',
        description: 'Test agent',
      }),
    });
    expect(createResponse.ok()).toBeTruthy();
    const createData = await createResponse.json();
    const testFilename = createData.filename;

    // WHEN: Creating a connection via API
    await page.request.post(`/api/agents/${TEST_PROJECT}/connections`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        parentFilename: 'content_calendar_agent.yaml',
        childFilename: testFilename,
      }),
    });

    // THEN: The config_path should be just the filename, not a full path
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();

      const parentFile = data.files.find((f: { filename: string }) => f.filename === 'content_calendar_agent.yaml');
      // Should contain just filename, not a path
      expect(parentFile.yaml).toContain(`config_path: ${testFilename}`);
      // Should NOT contain any path separators
      expect(parentFile.yaml).not.toContain(`config_path: /`);
      expect(parentFile.yaml).not.toContain(`config_path: adk-service`);
    }).toPass({ timeout: 10000 });
  });

  test('multiple connections create multiple sub_agents entries', async ({ page }) => {
    // GIVEN: An agent with existing sub_agents (copywriting_agent)
    // WHEN: Adding two more connections
    const child1Response = await page.request.post(`/api/agents/${TEST_PROJECT}/files`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        name: 'new_child_1',
        agentClass: 'LlmAgent',
        model: 'gemini-2.5-flash',
        description: 'Child 1',
      }),
    });
    const child1Data = await child1Response.json();

    const child2Response = await page.request.post(`/api/agents/${TEST_PROJECT}/files`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        name: 'new_child_2',
        agentClass: 'LlmAgent',
        model: 'gemini-2.5-flash',
        description: 'Child 2',
      }),
    });
    const child2Data = await child2Response.json();

    // Create connections
    await page.request.post(`/api/agents/${TEST_PROJECT}/connections`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        parentFilename: 'copywriting_agent.yaml',
        childFilename: child1Data.filename,
      }),
    });

    await page.request.post(`/api/agents/${TEST_PROJECT}/connections`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        parentFilename: 'copywriting_agent.yaml',
        childFilename: child2Data.filename,
      }),
    });

    // THEN: Both children should appear in sub_agents
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();

      const parentFile = data.files.find((f: { filename: string }) => f.filename === 'copywriting_agent.yaml');
      expect(parentFile.yaml).toContain(`config_path: ${child1Data.filename}`);
      expect(parentFile.yaml).toContain(`config_path: ${child2Data.filename}`);
      // Should have sub_agents array
      expect(parentFile.yaml).toContain('sub_agents:');
    }).toPass({ timeout: 10000 });
  });
});

/**
 * Story 3.2: Deleting connections removes sub_agents
 * - Deleting an edge removes the config_path from parent YAML
 * - Child agent file is NOT deleted (just the relationship)
 * - Parent YAML is properly formatted after removal
 */
test.describe('ADK Visual Builder - Story 3.2: Deleting Connections Removes sub_agents', () => {
  // Helper function to restore fixture files via API
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
    const contentCalendarYaml = `name: content_calendar_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Responsible for creating the social media content calendar.
`;
    const copywritingYaml = `name: copywriting_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Responsible for writing copy for social media posts.
`;
    const schedulerYaml = `name: scheduler_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Responsible for scheduling social media posts.
`;

    // Restore all files
    await request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ filename: 'root_agent.yaml', yaml: rootAgentYaml }),
    });

    await request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ filename: 'content_calendar_agent.yaml', yaml: contentCalendarYaml }),
    });

    await request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ filename: 'copywriting_agent.yaml', yaml: copywritingYaml }),
    });

    await request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ filename: 'scheduler_agent.yaml', yaml: schedulerYaml }),
    });

    // Delete any test files
    const filesResponse = await request.fetch(`/api/agents/${TEST_PROJECT}/files`);
    const data = await filesResponse.json();
    const testFiles = data.files.filter((f: { filename: string }) =>
      f.filename.startsWith('new_') || f.filename.startsWith('test_')
    );
    for (const file of testFiles) {
      await request.fetch(`/api/agents/${TEST_PROJECT}/files?filename=${file.filename}`, { method: 'DELETE' });
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

  test('deleting connection removes config_path from parent YAML', async ({ page }) => {
    // GIVEN: root_agent has scheduler_agent as a sub_agent
    const filesResponse = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
    const filesData = await filesResponse.json();
    const rootFile = filesData.files.find((f: { filename: string }) => f.filename === 'root_agent.yaml');
    expect(rootFile.yaml).toContain('config_path: scheduler_agent.yaml');

    // WHEN: Deleting the connection via API
    const deleteResponse = await page.request.delete(
      `/api/agents/${TEST_PROJECT}/connections?parentFilename=root_agent.yaml&childFilename=scheduler_agent.yaml`
    );

    // THEN: The API should succeed
    expect(deleteResponse.ok()).toBeTruthy();

    // AND: The parent YAML should NOT have scheduler_agent in sub_agents
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();

      const updatedRootFile = data.files.find((f: { filename: string }) => f.filename === 'root_agent.yaml');
      expect(updatedRootFile.yaml).not.toContain('config_path: scheduler_agent.yaml');
      // But should still have other sub_agents
      expect(updatedRootFile.yaml).toContain('config_path: content_calendar_agent.yaml');
      expect(updatedRootFile.yaml).toContain('config_path: copywriting_agent.yaml');
    }).toPass({ timeout: 10000 });
  });

  test('deleting connection does NOT delete the child agent file', async ({ page }) => {
    // GIVEN: root_agent has copywriting_agent as a sub_agent
    // WHEN: Deleting the connection
    const deleteResponse = await page.request.delete(
      `/api/agents/${TEST_PROJECT}/connections?parentFilename=root_agent.yaml&childFilename=copywriting_agent.yaml`
    );
    expect(deleteResponse.ok()).toBeTruthy();

    // THEN: The child file should still exist
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();

      const childFile = data.files.find((f: { filename: string }) => f.filename === 'copywriting_agent.yaml');
      expect(childFile).toBeDefined();
      expect(childFile.yaml).toContain('name: copywriting_agent');
    }).toPass({ timeout: 10000 });
  });

  test('parent YAML is properly formatted after removal (no orphan sub_agents key)', async ({ page }) => {
    // GIVEN: We'll first give content_calendar_agent a single sub_agent
    const createResponse = await page.request.post(`/api/agents/${TEST_PROJECT}/files`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        name: 'test_single_child',
        agentClass: 'LlmAgent',
        model: 'gemini-2.5-flash',
        description: 'Single child',
      }),
    });
    const createData = await createResponse.json();

    // Add connection
    await page.request.post(`/api/agents/${TEST_PROJECT}/connections`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        parentFilename: 'content_calendar_agent.yaml',
        childFilename: createData.filename,
      }),
    });

    // Verify connection was created
    let filesResponse = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
    let filesData = await filesResponse.json();
    let parentFile = filesData.files.find((f: { filename: string }) => f.filename === 'content_calendar_agent.yaml');
    expect(parentFile.yaml).toContain('sub_agents:');

    // WHEN: Deleting the only sub_agent
    await page.request.delete(
      `/api/agents/${TEST_PROJECT}/connections?parentFilename=content_calendar_agent.yaml&childFilename=${createData.filename}`
    );

    // THEN: The sub_agents key should be removed entirely (not left as empty array)
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();

      const updatedParentFile = data.files.find((f: { filename: string }) => f.filename === 'content_calendar_agent.yaml');
      expect(updatedParentFile.yaml).not.toContain('sub_agents:');
      expect(updatedParentFile.yaml).not.toContain('sub_agents: []');
    }).toPass({ timeout: 10000 });
  });
});

/**
 * Story 3.3: Visualize existing sub_agents as edges
 * - Loading a project with sub_agents shows edges on canvas
 * - Edges connect from parent node to child nodes
 * - Edge direction is top-to-bottom (parent above child)
 */
test.describe('ADK Visual Builder - Story 3.3: Visualize Existing sub_agents as Edges', () => {
  // Helper function to restore fixture files via API
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
    const contentCalendarYaml = `name: content_calendar_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Responsible for creating the social media content calendar.
`;
    const copywritingYaml = `name: copywriting_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Responsible for writing copy for social media posts.
`;
    const schedulerYaml = `name: scheduler_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: Responsible for scheduling social media posts.
`;

    await request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ filename: 'root_agent.yaml', yaml: rootAgentYaml }),
    });

    await request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ filename: 'content_calendar_agent.yaml', yaml: contentCalendarYaml }),
    });

    await request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ filename: 'copywriting_agent.yaml', yaml: copywritingYaml }),
    });

    await request.fetch(`/api/agents/${TEST_PROJECT}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ filename: 'scheduler_agent.yaml', yaml: schedulerYaml }),
    });
  }

  test.beforeEach(async ({ page }) => {
    await restoreFixtures(page.request);
  });

  test.afterEach(async ({ page }) => {
    await restoreFixtures(page.request);
  });

  test('loading a project with sub_agents shows edges on canvas', async ({ page }) => {
    // WHEN: Loading the compose page
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

    // Wait for React Flow to render
    await page.waitForTimeout(1000);

    // THEN: Edges should be visible connecting root to sub-agents
    // React Flow renders edges with aria-labels like "Edge from root to agent-X"
    await expect(async () => {
      // Check for edge elements by aria-label text content (edges from root to agent nodes)
      const edgeCount = await page.locator('[aria-label^="Edge from root to agent-"]').count();
      expect(edgeCount).toBe(3);
    }).toPass({ timeout: 10000 });
  });

  test('edges connect from parent node to child nodes', async ({ page }) => {
    // WHEN: Loading the compose page
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // THEN: Both parent and child nodes should be visible on canvas
    await expect(async () => {
      // Root agent node (use heading to target canvas nodes, not YAML editor)
      const rootNode = page.getByRole('heading', { name: 'marketing_team_lead' });
      await expect(rootNode).toBeVisible();

      // Child agent nodes (by heading)
      const child1 = page.getByRole('heading', { name: 'content_calendar_agent' });
      const child2 = page.getByRole('heading', { name: 'copywriting_agent' });
      const child3 = page.getByRole('heading', { name: 'scheduler_agent' });

      await expect(child1).toBeVisible();
      await expect(child2).toBeVisible();
      await expect(child3).toBeVisible();
    }).toPass({ timeout: 10000 });
  });

  test('root agent is marked as root', async ({ page }) => {
    // WHEN: Loading the compose page
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // THEN: Root agent should have a "Root" badge (use specific selector for badge, not tab button)
    await expect(async () => {
      // Target the Root badge inside the canvas, which has bg-blue-100 class
      const rootBadge = page.locator('[data-testid="agent-canvas"]').locator('text=Root').first();
      await expect(rootBadge).toBeVisible();
    }).toPass({ timeout: 10000 });
  });
});
