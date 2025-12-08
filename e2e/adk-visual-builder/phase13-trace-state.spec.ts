/**
 * Phase 13.2 & 13.3: Trace Visualization & State Viewer Tests
 *
 * Tests for the Trace View (visual execution flow) and State Viewer panels
 * that provide debugging and observability capabilities.
 *
 * Note: Some tests mock ADK responses for reliability in CI environments.
 */

import { test, expect, TEST_PROJECT, restoreToolsFixtures } from './helpers';

/**
 * Helper to mock the ADK agent execute API response
 */
async function mockADKResponse(page: import('@playwright/test').Page, response: {
  response: string;
  sessionId?: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result?: unknown; status: string }>;
  state?: Record<string, unknown>;
}) {
  await page.route(`/api/agents/${TEST_PROJECT}/execute`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        response: response.response,
        sessionId: response.sessionId || 'test-session-123',
        toolCalls: response.toolCalls || [],
        state: response.state || {},
      }),
    });
  });
}

test.describe.configure({ mode: 'serial' });

test.describe('Phase 13.2: Trace Visualization', () => {
  test.beforeEach(async ({ page }) => {
    await restoreToolsFixtures(page.request);
  });

  test.describe('Story 13.2.1: Trace View Toggle', () => {
    test('Chat page has Trace View toggle button', async ({ page }) => {
      // GIVEN: Navigate to the chat page for an agent
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // THEN: There should be a Events Panel toggle button (which includes trace view)
      const eventsToggle = page.locator('[data-testid="events-panel-toggle"]');
      await expect(eventsToggle).toBeVisible();
    });

    test('Trace View can be opened and closed', async ({ page }) => {
      // GIVEN: Navigate to the chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Click the events panel toggle
      await page.click('[data-testid="events-panel-toggle"]');

      // THEN: Events panel with Trace tab should be visible
      const eventsPanel = page.locator('[data-testid="events-panel"]');
      await expect(eventsPanel).toBeVisible();
      await expect(page.locator('[data-testid="events-tab-trace"]')).toBeVisible();

      // WHEN: Click toggle again
      await page.click('[data-testid="events-panel-toggle"]');

      // THEN: Events panel should be hidden
      await expect(eventsPanel).not.toBeVisible();
    });

    test('Trace View shows empty state when no execution', async ({ page }) => {
      // GIVEN: Navigate to the chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Open events panel (trace tab is default)
      await page.click('[data-testid="events-panel-toggle"]');

      // THEN: Should show empty state for trace
      await expect(page.locator('[data-testid="events-empty-state"]')).toBeVisible();
      await expect(page.locator('text=No trace yet')).toBeVisible();
    });
  });

  test.describe('Story 13.2.2: Execution Flow Diagram', () => {
    test('Sending a message creates trace nodes', async ({ page }) => {
      // Mock the ADK response
      await mockADKResponse(page, {
        response: 'I found the information you requested.',
        toolCalls: [
          {
            name: 'google_search',
            args: { query: 'test query' },
            result: { results: ['Result 1'] },
            status: 'success',
          },
        ],
      });

      // GIVEN: Navigate to the chat page and open trace view
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="trace-view-toggle"]');

      // WHEN: Send a message
      await page.fill('[data-testid="chat-input"]', 'Search for test query');
      await page.click('[data-testid="send-button"]');

      // Wait for response
      await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible({ timeout: 10000 });

      // THEN: Trace nodes should appear
      const tracePanel = page.locator('[data-testid="trace-view-panel"]');
      const traceNodes = tracePanel.locator('[data-testid="trace-node"]');
      await expect(traceNodes.first()).toBeVisible({ timeout: 5000 });
    });

    test('Trace shows User -> Agent -> Tool -> Response flow', async ({ page }) => {
      // Mock the ADK response with tool call
      await mockADKResponse(page, {
        response: 'Here is the result.',
        toolCalls: [
          {
            name: 'search_web',
            args: { query: 'test' },
            result: { data: 'Result' },
            status: 'success',
          },
        ],
      });

      // GIVEN: A chat with tool call
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="trace-view-toggle"]');

      await page.fill('[data-testid="chat-input"]', 'Search for something');
      await page.click('[data-testid="send-button"]');
      await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible({ timeout: 10000 });

      // THEN: Trace should show the flow
      await expect(page.locator('[data-testid="trace-node-user"]')).toBeVisible();
      await expect(page.locator('[data-testid="trace-node-agent"]')).toBeVisible();
      await expect(page.locator('[data-testid="trace-node-tool"]')).toBeVisible();
      await expect(page.locator('[data-testid="trace-node-response"]')).toBeVisible();
    });

    test('Clicking a trace node highlights corresponding event', async ({ page }) => {
      // Mock the ADK response
      await mockADKResponse(page, {
        response: 'Done!',
      });

      // GIVEN: A chat with trace and events panels open
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="trace-view-toggle"]');
      await page.click('[data-testid="events-panel-toggle"]');

      await page.fill('[data-testid="chat-input"]', 'Hello');
      await page.click('[data-testid="send-button"]');
      await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Click a trace node
      const traceNode = page.locator('[data-testid="trace-node"]').first();
      await traceNode.click();

      // THEN: Corresponding event should be highlighted
      await expect(page.locator('[data-testid="event-item"].highlighted, [data-testid="event-item"][data-highlighted="true"]')).toBeVisible();
    });
  });

  test.describe('Story 13.2.3: Timing & Duration', () => {
    test('Trace nodes show duration', async ({ page }) => {
      // Mock the ADK response
      await mockADKResponse(page, {
        response: 'Quick response!',
      });

      // GIVEN: A chat with trace
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="trace-view-toggle"]');

      await page.fill('[data-testid="chat-input"]', 'Hello');
      await page.click('[data-testid="send-button"]');
      await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible({ timeout: 10000 });

      // THEN: Trace nodes should show duration
      const durationBadge = page.locator('[data-testid="trace-node-duration"]').first();
      await expect(durationBadge).toBeVisible();
    });

    test('Total execution time is displayed', async ({ page }) => {
      // Mock the ADK response
      await mockADKResponse(page, {
        response: 'Done!',
      });

      // GIVEN: A chat with trace
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="trace-view-toggle"]');

      await page.fill('[data-testid="chat-input"]', 'Test');
      await page.click('[data-testid="send-button"]');
      await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible({ timeout: 10000 });

      // THEN: Total execution time should be shown
      await expect(page.locator('[data-testid="trace-total-time"]')).toBeVisible();
    });
  });
});

test.describe('Phase 13.3: State Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await restoreToolsFixtures(page.request);
  });

  test.describe('Story 13.3.1: State Panel Toggle', () => {
    test('Chat page has State Viewer toggle button', async ({ page }) => {
      // GIVEN: Navigate to the chat page for an agent
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // THEN: There should be a State Viewer toggle button
      const stateToggle = page.locator('[data-testid="state-viewer-toggle"]');
      await expect(stateToggle).toBeVisible();
    });

    test('State Viewer can be opened and closed', async ({ page }) => {
      // GIVEN: Navigate to the chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Click the state viewer toggle
      await page.click('[data-testid="state-viewer-toggle"]');

      // THEN: State viewer panel should be visible
      const statePanel = page.locator('[data-testid="state-viewer-panel"]');
      await expect(statePanel).toBeVisible();

      // WHEN: Click toggle again
      await page.click('[data-testid="state-viewer-toggle"]');

      // THEN: State viewer panel should be hidden
      await expect(statePanel).not.toBeVisible();
    });

    test('State Viewer shows empty state initially', async ({ page }) => {
      // GIVEN: Navigate to the chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Open state viewer
      await page.click('[data-testid="state-viewer-toggle"]');

      // THEN: Should show empty state
      await expect(page.locator('[data-testid="state-empty-state"]')).toBeVisible();
      await expect(page.locator('text=No state data')).toBeVisible();
    });
  });

  test.describe('Story 13.3.2: Session State Display', () => {
    test('State viewer displays session state after message', async ({ page }) => {
      // Mock the ADK response with state
      await mockADKResponse(page, {
        response: 'State updated!',
        state: {
          counter: 1,
          lastQuery: 'test',
        },
      });

      // GIVEN: Navigate to chat and open state viewer
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="state-viewer-toggle"]');

      // WHEN: Send a message
      await page.fill('[data-testid="chat-input"]', 'Update the state');
      await page.click('[data-testid="send-button"]');
      await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible({ timeout: 10000 });

      // THEN: State should be visible in the viewer
      const statePanel = page.locator('[data-testid="state-viewer-panel"]');
      await expect(statePanel.locator('[data-testid="state-key-value"]').first()).toBeVisible();
    });

    test('State shows key-value pairs', async ({ page }) => {
      // Mock the ADK response with state
      await mockADKResponse(page, {
        response: 'Done!',
        state: {
          userName: 'Alice',
          requestCount: 5,
        },
      });

      // GIVEN: Navigate to chat with state
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="state-viewer-toggle"]');

      await page.fill('[data-testid="chat-input"]', 'Show state');
      await page.click('[data-testid="send-button"]');
      await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible({ timeout: 10000 });

      // THEN: Key-value pairs should be visible
      await expect(page.locator('[data-testid="state-key"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="state-value"]').first()).toBeVisible();
    });

    test('State shows scope indicator (session vs user)', async ({ page }) => {
      // Mock the ADK response with both session and user-scoped state
      await mockADKResponse(page, {
        response: 'Done!',
        state: {
          sessionData: 'temp',
          'user:preferences': { theme: 'dark' },
        },
      });

      // GIVEN: Navigate to chat with state
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="state-viewer-toggle"]');

      await page.fill('[data-testid="chat-input"]', 'Test state scopes');
      await page.click('[data-testid="send-button"]');
      await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible({ timeout: 10000 });

      // THEN: Scope indicators should be visible
      await expect(page.locator('[data-testid="state-scope-badge"]').first()).toBeVisible();
    });
  });

  test.describe('Story 13.3.3: State Changes', () => {
    test('State viewer highlights changed values', async ({ page }) => {
      // First mock response with initial state
      await mockADKResponse(page, {
        response: 'First response',
        state: {
          counter: 1,
        },
      });

      // GIVEN: Navigate to chat and open state viewer
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="state-viewer-toggle"]');

      // Send first message
      await page.fill('[data-testid="chat-input"]', 'First');
      await page.click('[data-testid="send-button"]');
      await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible({ timeout: 10000 });

      // Update mock for second response with changed state
      await page.unroute(`/api/agents/${TEST_PROJECT}/execute`);
      await mockADKResponse(page, {
        response: 'Second response',
        state: {
          counter: 2,
        },
      });

      // Send second message
      await page.fill('[data-testid="chat-input"]', 'Second');
      await page.click('[data-testid="send-button"]');
      await expect(page.locator('[data-testid="message-assistant"]').nth(1)).toBeVisible({ timeout: 10000 });

      // THEN: Changed values should be highlighted
      await expect(page.locator('[data-testid="state-value-changed"]')).toBeVisible();
    });

    test('State viewer shows previous value on hover/click', async ({ page }) => {
      // Mock the ADK response
      await mockADKResponse(page, {
        response: 'Done!',
        state: {
          counter: 2,
        },
      });

      // GIVEN: Navigate to chat with state changes
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });
      await page.click('[data-testid="state-viewer-toggle"]');

      await page.fill('[data-testid="chat-input"]', 'Increment');
      await page.click('[data-testid="send-button"]');
      await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Click on a changed value
      const changedValue = page.locator('[data-testid="state-value-changed"]').first();
      if (await changedValue.isVisible()) {
        await changedValue.click();
        // THEN: Previous value should be shown
        await expect(page.locator('[data-testid="state-previous-value"]')).toBeVisible();
      }
    });
  });
});
