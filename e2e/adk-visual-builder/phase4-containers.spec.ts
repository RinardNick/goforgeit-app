import { test, expect } from '@playwright/test';
import { TEST_PROJECT, simulateDragDrop, getNodeId } from './helpers';

test.describe.configure({ mode: 'serial' });

/**
 * Story 4.1: Container Node Rendering
 * - SequentialAgent renders as a container with drop zone
 * - ParallelAgent renders as a container with drop zone
 * - LoopAgent renders as a container with drop zone
 * - Child agents appear inside the container visually
 */
test.describe('ADK Visual Builder - Story 4.1: Container Node Rendering', () => {
  test('SequentialAgent renders as a container with drop zone', async ({ page }) => {
    // First, create a SequentialAgent via API (using PUT to write raw YAML)
    const createResponse = await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_sequential.yaml',
        yaml: `name: test_sequential
agent_class: SequentialAgent
description: A test sequential agent
sub_agents: []`,
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    // WHEN: Loading the compose page
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // THEN: SequentialAgent should render with container styling and drop zone
    await expect(async () => {
      const sequentialNode = page.locator('[data-testid="container-node-sequential"]');
      await expect(sequentialNode).toBeVisible();
      // Should have a drop zone for child agents
      const dropZone = sequentialNode.locator('[data-testid="container-drop-zone"]');
      await expect(dropZone).toBeVisible();
    }).toPass({ timeout: 10000 });

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_sequential.yaml`);
  });

  test('ParallelAgent renders as a container with drop zone', async ({ page }) => {
    // First, create a ParallelAgent via API (using PUT to write raw YAML)
    const createResponse = await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_parallel.yaml',
        yaml: `name: test_parallel
agent_class: ParallelAgent
description: A test parallel agent
sub_agents: []`,
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    // WHEN: Loading the compose page
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // THEN: ParallelAgent should render with container styling and drop zone
    await expect(async () => {
      const parallelNode = page.locator('[data-testid="container-node-parallel"]');
      await expect(parallelNode).toBeVisible();
      // Should have a drop zone for child agents
      const dropZone = parallelNode.locator('[data-testid="container-drop-zone"]');
      await expect(dropZone).toBeVisible();
    }).toPass({ timeout: 10000 });

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_parallel.yaml`);
  });

  test('LoopAgent renders as a container with drop zone', async ({ page }) => {
    // First, create a LoopAgent via API (using PUT to write raw YAML)
    const createResponse = await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_loop.yaml',
        yaml: `name: test_loop
agent_class: LoopAgent
description: A test loop agent
max_iterations: 5
sub_agents: []`,
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    // WHEN: Loading the compose page
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // THEN: LoopAgent should render with container styling and drop zone
    await expect(async () => {
      const loopNode = page.locator('[data-testid="container-node-loop"]');
      await expect(loopNode).toBeVisible();
      // Should have a drop zone for child agents
      const dropZone = loopNode.locator('[data-testid="container-drop-zone"]');
      await expect(dropZone).toBeVisible();
    }).toPass({ timeout: 10000 });

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_loop.yaml`);
  });

  test('child agents appear inside the container visually', async ({ page }) => {
    // Create a SequentialAgent with sub_agents via API (using PUT to write raw YAML)
    const createParentResponse = await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_parent_container.yaml',
        yaml: `name: test_parent_container
agent_class: SequentialAgent
description: A parent container agent
sub_agents:
  - config_path: test_child_in_container.yaml`,
      },
    });
    expect(createParentResponse.ok()).toBeTruthy();

    // Create a child agent (using PUT to write raw YAML)
    const createChildResponse = await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_child_in_container.yaml',
        yaml: `name: test_child_in_container
agent_class: LlmAgent
model: gemini-2.5-flash
description: A child agent inside container`,
      },
    });
    expect(createChildResponse.ok()).toBeTruthy();

    // WHEN: Loading the compose page
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // THEN: The child agent should appear inside the container node
    await expect(async () => {
      // The container should exist
      const containerNode = page.locator('[data-testid="container-node-sequential"]');
      await expect(containerNode).toBeVisible();

      // The child should be rendered inside the container
      const childInsideContainer = containerNode.locator('[data-testid="container-child-agent"]');
      await expect(childInsideContainer).toBeVisible();

      // The child should show the correct name
      await expect(childInsideContainer.getByText('test_child_in_container')).toBeVisible();
    }).toPass({ timeout: 10000 });

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_parent_container.yaml`);
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_child_in_container.yaml`);
  });
});

/**
 * Story 4.2: Drag Into Container
 * - Dragging an existing agent into a SequentialAgent container adds it as sub_agent
 * - Dragging an existing agent into a ParallelAgent container adds it as sub_agent
 * - Order of children in SequentialAgent reflects execution order (YAML array order)
 */
test.describe('ADK Visual Builder - Story 4.2: Drag Into Container', () => {
  // Helper function to restore fixture files
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

  test('dragging an existing agent into a SequentialAgent container adds it as sub_agent', async ({ page }) => {
    // GIVEN: Create a SequentialAgent container and a standalone LlmAgent
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_sequential_container.yaml',
        yaml: `name: test_sequential_container
agent_class: SequentialAgent
description: A test sequential container`,
      },
    });

    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_standalone_agent.yaml',
        yaml: `name: test_standalone_agent
agent_class: LlmAgent
model: gemini-2.5-flash
description: A standalone agent to drag into container`,
      },
    });

    // Load the compose page
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // WHEN: Drag the standalone agent node into the SequentialAgent container drop zone
    const standaloneAgentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_standalone_agent' });
    await expect(standaloneAgentNode).toBeVisible({ timeout: 5000 });

    const containerDropZone = page.locator('[data-testid="container-node-sequential"] [data-testid="container-drop-zone"]');
    await expect(containerDropZone).toBeVisible({ timeout: 5000 });

    // Get the React Flow node ID from the agent node
    const nodeId = await getNodeId(standaloneAgentNode);

    // Simulate drag and drop with proper dataTransfer
    await simulateDragDrop(page, standaloneAgentNode, containerDropZone, nodeId);

    // Wait for the YAML file to be updated
    await page.waitForTimeout(1000);

    // THEN: The SequentialAgent YAML should have the standalone agent as a sub_agent
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();

      const containerFile = data.files.find((f: { filename: string }) => f.filename === 'test_sequential_container.yaml');
      expect(containerFile).toBeDefined();
      expect(containerFile.yaml).toContain('sub_agents:');
      expect(containerFile.yaml).toContain('config_path: test_standalone_agent.yaml');
    }).toPass({ timeout: 10000 });

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_sequential_container.yaml`);
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_standalone_agent.yaml`);
  });

  test('dragging an existing agent into a ParallelAgent container adds it as sub_agent', async ({ page }) => {
    // GIVEN: Create a ParallelAgent container and a standalone LlmAgent
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_parallel_container.yaml',
        yaml: `name: test_parallel_container
agent_class: ParallelAgent
description: A test parallel container`,
      },
    });

    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_parallel_child.yaml',
        yaml: `name: test_parallel_child
agent_class: LlmAgent
model: gemini-2.5-flash
description: A child agent for parallel container`,
      },
    });

    // Load the compose page
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // WHEN: Drag the child agent node into the ParallelAgent container drop zone
    const childAgentNode = page.locator('[data-testid="agent-node"]').filter({ hasText: 'test_parallel_child' });
    await expect(childAgentNode).toBeVisible({ timeout: 5000 });

    const containerDropZone = page.locator('[data-testid="container-node-parallel"] [data-testid="container-drop-zone"]');
    await expect(containerDropZone).toBeVisible({ timeout: 5000 });

    // Get the React Flow node ID from the agent node
    const nodeId = await getNodeId(childAgentNode);

    // Simulate drag and drop with proper dataTransfer
    await simulateDragDrop(page, childAgentNode, containerDropZone, nodeId);

    // Wait for the YAML file to be updated
    await page.waitForTimeout(1000);

    // THEN: The ParallelAgent YAML should have the child agent as a sub_agent
    await expect(async () => {
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();

      const containerFile = data.files.find((f: { filename: string }) => f.filename === 'test_parallel_container.yaml');
      expect(containerFile).toBeDefined();
      expect(containerFile.yaml).toContain('sub_agents:');
      expect(containerFile.yaml).toContain('config_path: test_parallel_child.yaml');
    }).toPass({ timeout: 10000 });

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_parallel_container.yaml`);
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_parallel_child.yaml`);
  });

  test('order of children in SequentialAgent reflects execution order (YAML array order)', async ({ page }) => {
    // GIVEN: Create a SequentialAgent with two existing children in a specific order
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_seq_ordered.yaml',
        yaml: `name: test_seq_ordered
agent_class: SequentialAgent
description: Sequential agent with ordered children
sub_agents:
  - config_path: test_first_step.yaml
  - config_path: test_second_step.yaml`,
      },
    });

    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_first_step.yaml',
        yaml: `name: test_first_step
agent_class: LlmAgent
model: gemini-2.5-flash
description: First step in sequence`,
      },
    });

    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_second_step.yaml',
        yaml: `name: test_second_step
agent_class: LlmAgent
model: gemini-2.5-flash
description: Second step in sequence`,
      },
    });

    // Load the compose page
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // THEN: The container should show children in the correct order (first_step before second_step)
    await expect(async () => {
      const containerNode = page.locator('[data-testid="container-node-sequential"]');
      await expect(containerNode).toBeVisible();

      // Get all child agents inside the container
      const childAgents = containerNode.locator('[data-testid="container-child-agent"]');
      const childCount = await childAgents.count();
      expect(childCount).toBe(2);

      // Verify order: first child should be test_first_step
      const firstChild = childAgents.nth(0);
      await expect(firstChild.getByText('test_first_step')).toBeVisible();

      // Second child should be test_second_step
      const secondChild = childAgents.nth(1);
      await expect(secondChild.getByText('test_second_step')).toBeVisible();
    }).toPass({ timeout: 10000 });

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_seq_ordered.yaml`);
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_first_step.yaml`);
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_second_step.yaml`);
  });
});

/**
 * Story 4.3: Container Layout
 * - SequentialAgent shows children in vertical list (execution order)
 * - ParallelAgent shows children in horizontal row (concurrent)
 * - LoopAgent shows children with loop indicator
 */
test.describe('ADK Visual Builder - Story 4.3: Container Layout', () => {
  test('SequentialAgent shows children in vertical list (execution order)', async ({ page }) => {
    // GIVEN: A SequentialAgent with multiple children
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_seq_layout.yaml',
        yaml: `name: test_seq_layout
agent_class: SequentialAgent
description: Sequential agent for layout test
sub_agents:
  - config_path: test_step_a.yaml
  - config_path: test_step_b.yaml`,
      },
    });

    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_step_a.yaml',
        yaml: `name: test_step_a
agent_class: LlmAgent
model: gemini-2.5-flash
description: Step A`,
      },
    });

    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_step_b.yaml',
        yaml: `name: test_step_b
agent_class: LlmAgent
model: gemini-2.5-flash
description: Step B`,
      },
    });

    // Load the compose page
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // THEN: The container should have vertical layout (flex-col)
    await expect(async () => {
      const containerNode = page.locator('[data-testid="container-node-sequential"]');
      await expect(containerNode).toBeVisible();

      // Get the drop zone that contains the children
      const dropZone = containerNode.locator('[data-testid="container-drop-zone"]');
      await expect(dropZone).toBeVisible();

      // Verify the drop zone has flex-col layout (vertical)
      const layoutClasses = await dropZone.getAttribute('class');
      expect(layoutClasses).toContain('flex-col');
      expect(layoutClasses).not.toContain('flex-row');

      // Verify children exist and are in order
      const childAgents = dropZone.locator('[data-testid="container-child-agent"]');
      const childCount = await childAgents.count();
      expect(childCount).toBe(2);

      // Verify vertical ordering: step_a should be above step_b (lower y position)
      const stepA = childAgents.nth(0);
      const stepB = childAgents.nth(1);
      await expect(stepA.getByText('test_step_a')).toBeVisible();
      await expect(stepB.getByText('test_step_b')).toBeVisible();
    }).toPass({ timeout: 10000 });

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_seq_layout.yaml`);
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_step_a.yaml`);
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_step_b.yaml`);
  });

  test('ParallelAgent shows children in horizontal row (concurrent)', async ({ page }) => {
    // GIVEN: A ParallelAgent with multiple children
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_parallel_layout.yaml',
        yaml: `name: test_parallel_layout
agent_class: ParallelAgent
description: Parallel agent for layout test
sub_agents:
  - config_path: test_task_x.yaml
  - config_path: test_task_y.yaml`,
      },
    });

    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_task_x.yaml',
        yaml: `name: test_task_x
agent_class: LlmAgent
model: gemini-2.5-flash
description: Task X`,
      },
    });

    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_task_y.yaml',
        yaml: `name: test_task_y
agent_class: LlmAgent
model: gemini-2.5-flash
description: Task Y`,
      },
    });

    // Load the compose page
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // THEN: The container should have horizontal layout (flex-row)
    await expect(async () => {
      const containerNode = page.locator('[data-testid="container-node-parallel"]');
      await expect(containerNode).toBeVisible();

      // Get the drop zone that contains the children
      const dropZone = containerNode.locator('[data-testid="container-drop-zone"]');
      await expect(dropZone).toBeVisible();

      // Verify the drop zone has flex-row layout (horizontal)
      const layoutClasses = await dropZone.getAttribute('class');
      expect(layoutClasses).toContain('flex-row');
      expect(layoutClasses).not.toContain('flex-col');

      // Verify children exist
      const childAgents = dropZone.locator('[data-testid="container-child-agent"]');
      const childCount = await childAgents.count();
      expect(childCount).toBe(2);

      // Verify both children are visible
      await expect(dropZone.getByText('test_task_x')).toBeVisible();
      await expect(dropZone.getByText('test_task_y')).toBeVisible();
    }).toPass({ timeout: 10000 });

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_parallel_layout.yaml`);
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_task_x.yaml`);
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_task_y.yaml`);
  });

  test('LoopAgent shows children with loop indicator', async ({ page }) => {
    // GIVEN: A LoopAgent with children
    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_loop_layout.yaml',
        yaml: `name: test_loop_layout
agent_class: LoopAgent
description: Loop agent for layout test
max_iterations: 5
sub_agents:
  - config_path: test_loop_step.yaml`,
      },
    });

    await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
      data: {
        filename: 'test_loop_step.yaml',
        yaml: `name: test_loop_step
agent_class: LlmAgent
model: gemini-2.5-flash
description: Loop step`,
      },
    });

    // Load the compose page
    await page.goto(`/${TEST_PROJECT}/compose`);
    await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // THEN: The LoopAgent should show a loop indicator
    await expect(async () => {
      const containerNode = page.locator('[data-testid="container-node-loop"]');
      await expect(containerNode).toBeVisible();

      // Verify the loop indicator is visible - look for the full "🔄 Loop until complete" text
      await expect(containerNode.getByText('🔄 Loop until complete')).toBeVisible();

      // Verify child is visible
      const dropZone = containerNode.locator('[data-testid="container-drop-zone"]');
      const childAgents = dropZone.locator('[data-testid="container-child-agent"]');
      const childCount = await childAgents.count();
      expect(childCount).toBe(1);
      await expect(dropZone.getByText('test_loop_step')).toBeVisible();
    }).toPass({ timeout: 10000 });

    // Cleanup
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_loop_layout.yaml`);
    await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_loop_step.yaml`);
  });
});
