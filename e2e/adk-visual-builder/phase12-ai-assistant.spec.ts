import { test, expect } from '@playwright/test';
import { TEST_PROJECT, restoreToolsFixtures } from './helpers';

test.describe.configure({ mode: 'serial' });

/**
 * Phase 12: AI Builder Assistant
 *
 * The AI Builder Assistant is a chat interface in the compose page that helps users:
 * - Answer questions about ADK concepts
 * - Generate agent architectures from natural language descriptions
 * - Add tools to existing agents
 * - Create sub-agents via chat
 * - Modify agent configurations through conversation
 *
 * Based on Google's ADK Visual Builder AI assistant implementation.
 */
test.describe('ADK Visual Builder - Phase 12: AI Builder Assistant', () => {
  test.beforeEach(async ({ page }) => {
    await restoreToolsFixtures(page.request);
  });

  test.afterEach(async ({ page }) => {
    await restoreToolsFixtures(page.request);
  });

  test.describe('12.1 Assistant Panel UI', () => {
    test('compose page shows AI Assistant toggle button', async ({ page }) => {
      // GIVEN: A project exists
      // WHEN: We navigate to the compose page
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      // THEN: An AI Assistant toggle button should be visible in the header
      await expect(page.locator('[data-testid="ai-assistant-toggle"]')).toBeVisible();
    });

    test('AI Assistant panel is open by default', async ({ page }) => {
      // GIVEN: We're on the compose page
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });

      // THEN: The AI Assistant panel should be visible by default (open on load)
      await expect(page.locator('[data-testid="ai-assistant-panel"]')).toBeVisible();

      // AND: It should have a chat input area
      await expect(page.locator('[data-testid="ai-assistant-input"]')).toBeVisible();

      // AND: It should have a send button
      await expect(page.locator('[data-testid="ai-assistant-send"]')).toBeVisible();
    });

    test('assistant panel shows welcome message with suggestions', async ({ page }) => {
      // GIVEN: We're on the compose page (AI Assistant is open by default)
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="ai-assistant-panel"]')).toBeVisible();

      // THEN: It should show a welcome message
      await expect(page.locator('[data-testid="ai-assistant-welcome"]')).toBeVisible();

      // AND: It should show example prompts/suggestions
      await expect(page.locator('[data-testid="ai-assistant-suggestions"]')).toBeVisible();
    });

    test('clicking toggle closes the AI Assistant panel', async ({ page }) => {
      // GIVEN: The AI Assistant panel is open by default
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="ai-assistant-panel"]')).toBeVisible();

      // WHEN: We click the toggle
      await page.locator('[data-testid="ai-assistant-toggle"]').click();

      // THEN: The panel should be hidden
      await expect(page.locator('[data-testid="ai-assistant-panel"]')).not.toBeVisible();
    });
  });

  test.describe('12.2 Chat Interface', () => {
    test('user can type a message in the input field', async ({ page }) => {
      // GIVEN: The AI Assistant panel is open by default
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="ai-assistant-panel"]')).toBeVisible();

      // WHEN: We type a message
      await page.locator('[data-testid="ai-assistant-input"]').fill('Hello, can you help me build an agent?');

      // THEN: The message should be visible in the input
      await expect(page.locator('[data-testid="ai-assistant-input"]')).toHaveValue('Hello, can you help me build an agent?');
    });

    test('pressing Enter sends the message', async ({ page }) => {
      // GIVEN: The AI Assistant panel is open by default with a message typed
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="ai-assistant-panel"]')).toBeVisible();
      await page.locator('[data-testid="ai-assistant-input"]').fill('What tools are available?');

      // WHEN: We press Enter
      await page.locator('[data-testid="ai-assistant-input"]').press('Enter');

      // THEN: The message should appear in the chat history
      await expect(page.locator('[data-testid="ai-assistant-messages"]')).toContainText('What tools are available?');

      // AND: The input should be cleared
      await expect(page.locator('[data-testid="ai-assistant-input"]')).toHaveValue('');
    });

    test('clicking send button sends the message', async ({ page }) => {
      // GIVEN: The AI Assistant panel is open by default with a message typed
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="ai-assistant-panel"]')).toBeVisible();
      await page.locator('[data-testid="ai-assistant-input"]').fill('Help me understand agent types');

      // WHEN: We click the send button
      await page.locator('[data-testid="ai-assistant-send"]').click();

      // THEN: The message should appear in the chat history
      await expect(page.locator('[data-testid="ai-assistant-messages"]')).toContainText('Help me understand agent types');
    });

    // NOTE: This test makes real Gemini API calls - skipped to save costs and avoid flakiness
    test('assistant responds with a message after user sends', async ({ page }) => {
      // GIVEN: The AI Assistant panel is open by default
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="ai-assistant-panel"]')).toBeVisible();

      // WHEN: We send a message
      await page.locator('[data-testid="ai-assistant-input"]').fill('What is an LlmAgent?');
      await page.locator('[data-testid="ai-assistant-send"]').click();

      // THEN: The assistant should respond (wait for assistant message)
      await expect(page.locator('[data-testid="assistant-message"]').first()).toBeVisible({ timeout: 30000 });
    });

    // NOTE: This test makes real Gemini API calls - skipped to save costs and avoid flakiness
    test('shows loading indicator while assistant is thinking', async ({ page }) => {
      // GIVEN: The AI Assistant panel is open by default
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="ai-assistant-panel"]')).toBeVisible();

      // WHEN: We send a message
      await page.locator('[data-testid="ai-assistant-input"]').fill('Create a new agent');
      await page.locator('[data-testid="ai-assistant-send"]').click();

      // THEN: A loading indicator should appear while waiting for response
      await expect(page.locator('[data-testid="ai-assistant-loading"]')).toBeVisible();
    });
  });

  test.describe('12.3 Agent Generation from Description', () => {
    // The AI assistant uses an agentic loop that automatically executes tools
    // and shows executed actions in the response.
    // NOTE: These tests make real Gemini API calls - skip to save costs

    test('assistant auto-executes create_agent and shows success', async ({ page }) => {
      // GIVEN: The AI Assistant panel is open by default
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="ai-assistant-panel"]')).toBeVisible();

      // WHEN: We ask the assistant to create an agent
      await page.locator('[data-testid="ai-assistant-input"]').fill(
        'Create a new LLM agent called "research_helper" with description "Helps with web research" and add google_search tool'
      );
      await page.locator('[data-testid="ai-assistant-send"]').click();

      // THEN: Loading should show
      await expect(page.locator('[data-testid="ai-assistant-loading"]')).toBeVisible();

      // AND: The assistant should respond with executed actions (agentic loop auto-executes)
      await expect(page.locator('[data-testid="assistant-message"]').first()).toBeVisible({ timeout: 60000 });

      // AND: There should be executed actions showing what was done
      await expect(page.locator('[data-testid="executed-actions"]')).toBeVisible({ timeout: 5000 });

      // AND: At least one action should have been executed successfully
      const actionItems = page.locator('[data-testid="executed-action-item"]');
      await expect(actionItems.first()).toBeVisible();

      // AND: The create_agent action should show success (green checkmark)
      const createAgentAction = actionItems.filter({ hasText: 'create_agent' });
      await expect(createAgentAction).toBeVisible();
      await expect(createAgentAction.locator('.text-green-600')).toBeVisible();

      // Cleanup: Delete the created agent
      await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=research_helper.yaml`);
    });

    test('agent file is created after assistant processes request', async ({ page }) => {
      // GIVEN: The AI Assistant panel is open by default
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="ai-assistant-panel"]')).toBeVisible();

      // WHEN: We ask the assistant to create an agent
      await page.locator('[data-testid="ai-assistant-input"]').fill(
        'Create a new SequentialAgent called "test_workflow_agent" with description "A test workflow"'
      );
      await page.locator('[data-testid="ai-assistant-send"]').click();

      // Wait for response with executed actions
      await expect(page.locator('[data-testid="assistant-message"]').first()).toBeVisible({ timeout: 60000 });
      await expect(page.locator('[data-testid="executed-actions"]')).toBeVisible({ timeout: 5000 });

      // THEN: Verify the file was created via API
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      const agentFile = data.files.find((f: { filename: string }) => f.filename === 'test_workflow_agent.yaml');
      expect(agentFile).toBeTruthy();
      expect(agentFile.yaml).toContain('test_workflow_agent');
      expect(agentFile.yaml).toContain('SequentialAgent');

      // Cleanup
      await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_workflow_agent.yaml`);
    });
  });

  test.describe('12.4 Tool Addition via Chat', () => {
    // The AI assistant uses an agentic loop that automatically executes tools
    // NOTE: These tests make real Gemini API calls - skip to save costs

    test('assistant auto-executes add_tool and modifies agent file', async ({ page }) => {
      // GIVEN: An LlmAgent exists and AI Assistant is open by default
      await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
        data: {
          filename: 'test_tool_agent.yaml',
          yaml: `name: test_tool_agent
agent_class: LlmAgent
model: gemini-2.0-flash-exp
description: An agent for testing tool addition`,
        },
      });

      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="ai-assistant-panel"]')).toBeVisible();

      // WHEN: We ask to add a tool to the agent
      await page.locator('[data-testid="ai-assistant-input"]').fill(
        'Add the google_search tool to the test_tool_agent agent'
      );
      await page.locator('[data-testid="ai-assistant-send"]').click();

      // THEN: The assistant should respond with executed actions
      await expect(page.locator('[data-testid="assistant-message"]').first()).toBeVisible({ timeout: 60000 });
      await expect(page.locator('[data-testid="executed-actions"]')).toBeVisible({ timeout: 5000 });

      // AND: The add_tool action should show success
      const actionItems = page.locator('[data-testid="executed-action-item"]');
      const addToolAction = actionItems.filter({ hasText: 'add_tool' });
      await expect(addToolAction).toBeVisible();
      await expect(addToolAction.locator('.text-green-600')).toBeVisible();

      // THEN: The tool should be added to the agent's YAML
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();
      const agentFile = data.files.find((f: { filename: string }) => f.filename === 'test_tool_agent.yaml');
      expect(agentFile.yaml).toContain('google_search');

      // Cleanup
      await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_tool_agent.yaml`);
    });
  });

  test.describe('12.5 Sub-Agent Creation via Chat', () => {
    // The AI assistant uses an agentic loop that automatically executes tools
    // NOTE: These tests make real Gemini API calls - skip to save costs

    test('assistant creates sub-agent and links it to parent', async ({ page }) => {
      // GIVEN: A SequentialAgent exists and AI Assistant is open by default
      await page.request.put(`/api/agents/${TEST_PROJECT}/files`, {
        data: {
          filename: 'test_parent_agent.yaml',
          yaml: `name: test_parent_agent
agent_class: SequentialAgent
description: A parent agent for testing sub-agent creation`,
        },
      });

      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="ai-assistant-panel"]')).toBeVisible();

      // WHEN: We ask to create and add a sub-agent
      await page.locator('[data-testid="ai-assistant-input"]').fill(
        'Create a new LLM agent called "child_worker" with description "A helper agent" and add it as a sub-agent to test_parent_agent'
      );
      await page.locator('[data-testid="ai-assistant-send"]').click();

      // THEN: The assistant should respond with executed actions
      await expect(page.locator('[data-testid="assistant-message"]').first()).toBeVisible({ timeout: 60000 });
      await expect(page.locator('[data-testid="executed-actions"]')).toBeVisible({ timeout: 5000 });

      // AND: Multiple actions should have been executed (create_agent + add_sub_agent)
      const actionItems = page.locator('[data-testid="executed-action-item"]');
      const count = await actionItems.count();
      expect(count).toBeGreaterThanOrEqual(2);

      // Verify the sub-agent file was created and parent was updated
      const response = await page.request.get(`/api/agents/${TEST_PROJECT}/files`);
      const data = await response.json();

      // Check that child_worker.yaml was created
      const childFile = data.files.find((f: { filename: string }) => f.filename === 'child_worker.yaml');
      expect(childFile).toBeTruthy();
      expect(childFile.yaml).toContain('child_worker');

      // Check that parent now has the sub_agent reference
      const parentFile = data.files.find((f: { filename: string }) => f.filename === 'test_parent_agent.yaml');
      expect(parentFile.yaml).toContain('child_worker');

      // Cleanup
      await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=test_parent_agent.yaml`);
      await page.request.delete(`/api/agents/${TEST_PROJECT}/files?filename=child_worker.yaml`);
    });
  });

  test.describe('12.6 Context Awareness', () => {
    // These tests depend on actual AI responses which can vary
    test('assistant knows about current agents in the project', async ({ page }) => {
      // GIVEN: The compose page is loaded with existing agents and AI Assistant is open by default
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="ai-assistant-panel"]')).toBeVisible();

      // WHEN: We ask about the current agents
      await page.locator('[data-testid="ai-assistant-input"]').fill(
        'What agents are currently in this project?'
      );
      await page.locator('[data-testid="ai-assistant-send"]').click();

      // THEN: The assistant should respond with information about the existing agents
      await expect(page.locator('[data-testid="assistant-message"]').first()).toBeVisible({ timeout: 30000 });

      // The response should mention the root agent
      const messageText = await page.locator('[data-testid="assistant-message"]').first().textContent();
      expect(messageText?.toLowerCase()).toContain('marketing');
    });

    test('assistant shows current agent context when one is selected', async ({ page }) => {
      // GIVEN: An agent is selected on the canvas with AI Assistant open by default
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="ai-assistant-panel"]')).toBeVisible();
      await page.waitForTimeout(1000);

      // Select an agent
      const agentNode = page.locator('[data-testid="agent-node"]').first();
      await agentNode.click({ force: true });

      // THEN: The assistant panel should show which agent is selected
      await expect(page.locator('[data-testid="ai-assistant-context"]')).toBeVisible();
    });
  });

  test.describe('12.7 Suggestion Chips', () => {
    test('clicking a suggestion chip fills the input', async ({ page }) => {
      // GIVEN: The AI Assistant panel is open by default with suggestions visible
      await page.goto(`/${TEST_PROJECT}/compose`);
      await expect(page.locator('[data-testid="agent-canvas"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="ai-assistant-panel"]')).toBeVisible();
      await expect(page.locator('[data-testid="ai-assistant-suggestions"]')).toBeVisible();

      // WHEN: We click a suggestion chip
      const suggestionChip = page.locator('[data-testid="ai-assistant-suggestion"]').first();
      const suggestionText = await suggestionChip.textContent();
      await suggestionChip.click();

      // THEN: The input should be filled with the suggestion text
      await expect(page.locator('[data-testid="ai-assistant-input"]')).toHaveValue(suggestionText || '');
    });
  });
});
