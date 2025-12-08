/**
 * Phase 15.1: Session Management Tests
 *
 * Tests for the session management UI that allows users to:
 * - List all sessions for a project
 * - Create new sessions
 * - Delete sessions
 * - Switch between sessions
 * - View session metadata
 *
 * Reference: ADK Sessions API - https://google.github.io/adk-docs/sessions/
 */

import { test, expect, TEST_PROJECT } from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 15.1: Session Management', () => {
  // Clean up sessions before each test to ensure isolation
  test.beforeEach(async ({ request }) => {
    await request.delete(`/api/agents/${TEST_PROJECT}/sessions/cleanup`);
  });

  test.describe('Story 15.1.1: Sessions Panel UI', () => {
    test('Chat page has Sessions panel toggle', async ({ page }) => {
      // GIVEN: Navigate to the chat page for an agent
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // THEN: There should be a Sessions panel toggle button in the header
      const sessionsToggle = page.locator('[data-testid="sessions-panel-toggle"]');
      await expect(sessionsToggle).toBeVisible();
    });

    test('Sessions panel can be opened and closed', async ({ page }) => {
      // GIVEN: Navigate to the chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Click the sessions toggle button
      const sessionsToggle = page.locator('[data-testid="sessions-panel-toggle"]');
      await sessionsToggle.click();

      // THEN: Sessions panel should be visible
      const sessionsPanel = page.locator('[data-testid="sessions-panel"]');
      await expect(sessionsPanel).toBeVisible();

      // WHEN: Click toggle again
      await sessionsToggle.click();

      // THEN: Sessions panel should be hidden
      await expect(sessionsPanel).not.toBeVisible();
    });

    test('Sessions panel shows list of sessions', async ({ page }) => {
      // GIVEN: Navigate to chat page and open sessions panel
      await page.goto(`/${TEST_PROJECT}/chat`);
      await page.locator('[data-testid="sessions-panel-toggle"]').click();
      const sessionsPanel = page.locator('[data-testid="sessions-panel"]');
      await expect(sessionsPanel).toBeVisible();

      // THEN: Should show sessions list
      const sessionsList = sessionsPanel.locator('[data-testid="sessions-list"]');
      await expect(sessionsList).toBeVisible();
    });
  });

  test.describe('Story 15.1.2: Create New Session', () => {
    test('User can create a new session', async ({ page }) => {
      // GIVEN: Navigate to chat page and open sessions panel
      await page.goto(`/${TEST_PROJECT}/chat`);
      await page.locator('[data-testid="sessions-panel-toggle"]').click();
      const sessionsPanel = page.locator('[data-testid="sessions-panel"]');
      await expect(sessionsPanel).toBeVisible();

      // WHEN: Click "New Session" button
      const newSessionBtn = sessionsPanel.locator('[data-testid="new-session-btn"]');
      await expect(newSessionBtn).toBeVisible();
      await newSessionBtn.click();

      // THEN: A new session should be created and become active
      // The session list should update to show the new session
      await expect(sessionsPanel.locator('[data-testid="session-item"][data-active="true"]')).toBeVisible({ timeout: 5000 });
    });

    test('Creating new session clears chat history', async ({ page }) => {
      // GIVEN: Chat page with existing messages
      await page.goto(`/${TEST_PROJECT}/chat`);
      const chatInput = page.locator('[data-testid="chat-input"]');
      const sendButton = page.locator('[data-testid="send-button"]');

      // Send a message
      await chatInput.fill('Test message');
      await sendButton.click();

      // Verify message appears
      await expect(page.locator('[data-testid="chat-messages"]')).toContainText('Test message', { timeout: 5000 });

      // WHEN: Create new session
      await page.locator('[data-testid="sessions-panel-toggle"]').click();
      await page.locator('[data-testid="new-session-btn"]').click();

      // THEN: Chat history should be cleared
      const messages = page.locator('[data-testid="chat-messages"] [data-testid^="message-"]');
      await expect(messages).toHaveCount(0);
    });
  });

  test.describe('Story 15.1.3: Delete Session', () => {
    test('User can delete a session', async ({ page }) => {
      // GIVEN: Chat page with at least one session
      await page.goto(`/${TEST_PROJECT}/chat`);
      await page.locator('[data-testid="sessions-panel-toggle"]').click();
      const sessionsPanel = page.locator('[data-testid="sessions-panel"]');

      // Create a session to delete
      await page.locator('[data-testid="new-session-btn"]').click();
      await page.waitForTimeout(500);

      // Get the active session and track its ID
      const activeSession = sessionsPanel.locator('[data-testid="session-item"][data-active="true"]').first();
      await expect(activeSession).toBeVisible();
      const sessionId = await activeSession.getAttribute('data-session-id');

      // WHEN: Click delete button on session
      const deleteBtn = activeSession.locator('[data-testid="delete-session-btn"]');
      await deleteBtn.click();

      // Confirm deletion
      const confirmDialog = page.locator('[data-testid="delete-session-dialog"]');
      await expect(confirmDialog).toBeVisible();
      await confirmDialog.locator('[data-testid="confirm-delete-btn"]').click();

      // THEN: The specific session we created should be removed from list
      await expect(sessionsPanel.locator(`[data-testid="session-item"][data-session-id="${sessionId}"]`)).not.toBeVisible({ timeout: 3000 });
    });

    test('Deleting active session switches to another session', async ({ page }) => {
      // GIVEN: Multiple sessions exist
      await page.goto(`/${TEST_PROJECT}/chat`);
      await page.locator('[data-testid="sessions-panel-toggle"]').click();
      const sessionsPanel = page.locator('[data-testid="sessions-panel"]');

      // Create first session
      await page.locator('[data-testid="new-session-btn"]').click();
      await page.waitForTimeout(500);
      const firstSessionId = await sessionsPanel.locator('[data-testid="session-item"][data-active="true"]').getAttribute('data-session-id');

      // Create second session
      await page.locator('[data-testid="new-session-btn"]').click();
      await page.waitForTimeout(500);

      // WHEN: Delete the active (second) session
      const activeSession = sessionsPanel.locator('[data-testid="session-item"][data-active="true"]').first();
      await activeSession.locator('[data-testid="delete-session-btn"]').click();
      await page.locator('[data-testid="confirm-delete-btn"]').click();

      // THEN: Should automatically switch to the first session
      await expect(sessionsPanel.locator(`[data-testid="session-item"][data-session-id="${firstSessionId}"][data-active="true"]`)).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Story 15.1.4: Switch Between Sessions', () => {
    test('User can switch between sessions', async ({ page }) => {
      // GIVEN: Multiple sessions exist
      await page.goto(`/${TEST_PROJECT}/chat`);
      await page.locator('[data-testid="sessions-panel-toggle"]').click();
      const sessionsPanel = page.locator('[data-testid="sessions-panel"]');

      // Create first session
      await page.locator('[data-testid="new-session-btn"]').click();
      await page.waitForTimeout(500);
      const firstSessionId = await sessionsPanel.locator('[data-testid="session-item"][data-active="true"]').getAttribute('data-session-id');

      // Create second session
      await page.locator('[data-testid="new-session-btn"]').click();
      await page.waitForTimeout(500);

      // WHEN: Click on the first session to switch to it
      const firstSession = sessionsPanel.locator(`[data-testid="session-item"][data-session-id="${firstSessionId}"]`);
      await firstSession.click();

      // THEN: First session should become active
      await expect(firstSession).toHaveAttribute('data-active', 'true');
    });

    test('Switching sessions preserves chat history', async ({ page }) => {
      // GIVEN: Session 1 with a message
      await page.goto(`/${TEST_PROJECT}/chat`);
      const chatInput = page.locator('[data-testid="chat-input"]');
      const sendButton = page.locator('[data-testid="send-button"]');

      // Send message in first session
      await chatInput.fill('Message in session 1');
      await sendButton.click();
      await expect(page.locator('[data-testid="chat-messages"]')).toContainText('Message in session 1', { timeout: 5000 });

      // Get session ID
      await page.locator('[data-testid="sessions-panel-toggle"]').click();
      const sessionsPanel = page.locator('[data-testid="sessions-panel"]');
      const session1Id = await sessionsPanel.locator('[data-testid="session-item"][data-active="true"]').getAttribute('data-session-id');

      // Create Session 2 and send different message
      await page.locator('[data-testid="new-session-btn"]').click();
      await page.waitForTimeout(500);
      await chatInput.fill('Message in session 2');
      await sendButton.click();
      await expect(page.locator('[data-testid="chat-messages"]')).toContainText('Message in session 2', { timeout: 5000 });

      // WHEN: Switch back to session 1
      await page.locator('[data-testid="sessions-panel-toggle"]').click();
      await sessionsPanel.locator(`[data-testid="session-item"][data-session-id="${session1Id}"]`).click();

      // THEN: Should see session 1's message, not session 2's
      await expect(page.locator('[data-testid="chat-messages"]')).toContainText('Message in session 1');
      await expect(page.locator('[data-testid="chat-messages"]')).not.toContainText('Message in session 2');
    });
  });

  test.describe('Story 15.1.B: Edit Session State UI', () => {
    // Helper to open state panel via debug panel
    async function openStatePanel(page: typeof import('@playwright/test').Page.prototype) {
      // Open the debug panel first using the visible Debug button
      const debugToggle = page.locator('[data-testid="debug-panel-toggle"]');
      await debugToggle.click();

      // Wait for debug panel to appear
      await expect(page.locator('[data-testid="debug-tab-state"]')).toBeVisible({ timeout: 5000 });

      // Then click on the state tab within the debug panel
      const stateTab = page.locator('[data-testid="debug-tab-state"]');
      await stateTab.click();

      // Wait for state panel to be visible
      await expect(page.locator('[data-testid="state-viewer-panel"]')).toBeVisible();
    }

    test('State panel shows edit button for each state entry', async ({ page, request }) => {
      // GIVEN: A session with state
      const createResponse = await request.post(`/api/agents/${TEST_PROJECT}/sessions`);
      const { session_id: sessionId } = await createResponse.json();

      // Set some initial state
      await request.patch(`/api/agents/${TEST_PROJECT}/sessions/${sessionId}`, {
        data: { stateDelta: { counter: 5, user_name: 'Test User' } },
      });

      // Navigate to chat and open state panel
      await page.goto(`/${TEST_PROJECT}/chat?sessionId=${sessionId}`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // Open state panel via debug panel
      await openStatePanel(page);

      // THEN: Each state entry should have an edit button
      const stateEntries = page.locator('[data-testid="state-key-value"]');
      await expect(stateEntries).toHaveCount(2, { timeout: 5000 });

      const editButtons = page.locator('[data-testid="edit-state-btn"]');
      await expect(editButtons).toHaveCount(2);

      // Cleanup
      await request.delete(`/api/agents/${TEST_PROJECT}/sessions/${sessionId}`);
    });

    test('User can edit a state value inline', async ({ page, request }) => {
      // GIVEN: A session with state
      const createResponse = await request.post(`/api/agents/${TEST_PROJECT}/sessions`);
      const { session_id: sessionId } = await createResponse.json();

      await request.patch(`/api/agents/${TEST_PROJECT}/sessions/${sessionId}`, {
        data: { stateDelta: { counter: 5 } },
      });

      await page.goto(`/${TEST_PROJECT}/chat?sessionId=${sessionId}`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // Open state panel via debug panel
      await openStatePanel(page);

      // WHEN: Click edit button on the counter entry
      const editBtn = page.locator('[data-testid="edit-state-btn"]').first();
      await editBtn.click();

      // THEN: An inline editor should appear
      const editor = page.locator('[data-testid="state-value-editor"]');
      await expect(editor).toBeVisible();

      // Change the value
      await editor.fill('10');

      // Save
      const saveBtn = page.locator('[data-testid="save-state-btn"]');
      await saveBtn.click();

      // THEN: Value should be updated
      await expect(page.locator('[data-testid="state-value"]').first()).toContainText('10');

      // Cleanup
      await request.delete(`/api/agents/${TEST_PROJECT}/sessions/${sessionId}`);
    });

    test('User can add a new state key-value pair', async ({ page, request }) => {
      // GIVEN: A session (empty state)
      const createResponse = await request.post(`/api/agents/${TEST_PROJECT}/sessions`);
      const { session_id: sessionId } = await createResponse.json();

      await page.goto(`/${TEST_PROJECT}/chat?sessionId=${sessionId}`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // Open state panel via debug panel
      await openStatePanel(page);

      // WHEN: Click "Add State" button
      const addStateBtn = page.locator('[data-testid="add-state-btn"]');
      await addStateBtn.click();

      // THEN: A dialog/form should appear for adding new state
      const keyInput = page.locator('[data-testid="new-state-key-input"]');
      const valueInput = page.locator('[data-testid="new-state-value-input"]');
      await expect(keyInput).toBeVisible();
      await expect(valueInput).toBeVisible();

      // Fill in new state
      await keyInput.fill('my_custom_key');
      await valueInput.fill('my_custom_value');

      // Save
      await page.locator('[data-testid="save-new-state-btn"]').click();

      // THEN: New state should appear in the panel
      await expect(page.locator('[data-testid="state-key"]')).toContainText('my_custom_key');
      await expect(page.locator('[data-testid="state-value"]')).toContainText('my_custom_value');

      // Cleanup
      await request.delete(`/api/agents/${TEST_PROJECT}/sessions/${sessionId}`);
    });
  });

  test.describe('Story 15.1.5: Session Metadata Display', () => {
    test('Session items show metadata', async ({ page }) => {
      // GIVEN: Chat page with sessions
      await page.goto(`/${TEST_PROJECT}/chat`);
      await page.locator('[data-testid="sessions-panel-toggle"]').click();
      const sessionsPanel = page.locator('[data-testid="sessions-panel"]');

      // Create a session
      await page.locator('[data-testid="new-session-btn"]').click();
      await page.waitForTimeout(500);

      // THEN: Session item should show metadata
      const sessionItem = sessionsPanel.locator('[data-testid="session-item"][data-active="true"]').first();

      // Should show session ID (first 8 characters)
      const sessionId = sessionItem.locator('[data-testid="session-id-display"]');
      await expect(sessionId).toBeVisible();
      await expect(sessionId).toContainText(/[a-f0-9]{8}/);

      // Should show created timestamp
      const timestamp = sessionItem.locator('[data-testid="session-timestamp"]');
      await expect(timestamp).toBeVisible();

      // Should show message count
      const messageCount = sessionItem.locator('[data-testid="session-message-count"]');
      await expect(messageCount).toBeVisible();
      await expect(messageCount).toContainText('0');
    });

    test('Message count updates when messages are sent', async ({ page }) => {
      // GIVEN: New session
      await page.goto(`/${TEST_PROJECT}/chat`);
      await page.locator('[data-testid="sessions-panel-toggle"]').click();
      await page.locator('[data-testid="new-session-btn"]').click();
      await page.waitForTimeout(500);

      const sessionsPanel = page.locator('[data-testid="sessions-panel"]');
      const sessionItem = sessionsPanel.locator('[data-testid="session-item"][data-active="true"]').first();
      const messageCount = sessionItem.locator('[data-testid="session-message-count"]');

      // Verify starting count is 0
      await expect(messageCount).toContainText('0');

      // WHEN: Send a message
      const chatInput = page.locator('[data-testid="chat-input"]');
      const sendButton = page.locator('[data-testid="send-button"]');
      await chatInput.fill('Test message');
      await sendButton.click();
      await page.waitForTimeout(1000);

      // THEN: Message count should increment
      await page.locator('[data-testid="sessions-panel-toggle"]').click(); // Ensure panel is visible
      await expect(messageCount).toContainText('1', { timeout: 3000 });
    });
  });
});
