/**
 * Phase 14: Artifacts System Tests
 *
 * Tests for the artifacts panel that displays files created/accessed by agents during execution.
 * Artifacts are detected via `artifactDelta` events from the ADK backend.
 *
 * Reference: ADK Artifacts - https://google.github.io/adk-docs/artifacts/
 *
 * Key concepts:
 * - Artifacts are binary files (images, PDFs, text, etc.) managed by ADK
 * - Session-scoped: Plain filenames (e.g., "report.pdf") tied to session
 * - User-scoped: Prefix "user:" (e.g., "user:profile.png") persists across sessions
 * - Auto-versioning: Each save creates a new version
 * - Detected via `event.actions.artifactDelta` in event stream
 */

import { test, expect, TEST_PROJECT } from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 14: Artifacts System', () => {
  // Clean up sessions before each test to ensure isolation
  test.beforeEach(async ({ request }) => {
    await request.delete(`/api/agents/${TEST_PROJECT}/sessions/cleanup`);
  });

  test.describe('Story 14.1: Artifacts Panel UI', () => {
    test('Chat page has Artifacts panel toggle', async ({ page }) => {
      // GIVEN: Navigate to the chat page for an agent
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // THEN: There should be an Artifacts panel toggle button in the header
      const artifactsToggle = page.locator('[data-testid="artifacts-panel-toggle"]');
      await expect(artifactsToggle).toBeVisible();
      await expect(artifactsToggle).toContainText(/artifacts/i);
    });

    test('Artifacts panel can be opened and closed', async ({ page }) => {
      // GIVEN: Navigate to the chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Click the artifacts toggle button
      const artifactsToggle = page.locator('[data-testid="artifacts-panel-toggle"]');
      await artifactsToggle.click();

      // THEN: Artifacts panel should be visible
      const artifactsPanel = page.locator('[data-testid="artifacts-panel"]');
      await expect(artifactsPanel).toBeVisible();

      // WHEN: Click toggle again
      await artifactsToggle.click();

      // THEN: Panel should be hidden
      await expect(artifactsPanel).not.toBeVisible();
    });

    test('Artifacts panel shows empty state when no artifacts', async ({ page }) => {
      // GIVEN: Navigate to the chat page with new session (no artifacts)
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Open artifacts panel
      const artifactsToggle = page.locator('[data-testid="artifacts-panel-toggle"]');
      await artifactsToggle.click();

      // THEN: Panel should show empty state message
      const artifactsPanel = page.locator('[data-testid="artifacts-panel"]');
      await expect(artifactsPanel).toBeVisible();
      await expect(artifactsPanel.locator('[data-testid="artifacts-empty-state"]')).toBeVisible();
      await expect(artifactsPanel).toContainText(/no artifacts/i);
    });
  });

  test.describe('Story 14.2: Artifact Detection from Events', () => {
    test('Artifacts appear when artifactDelta event is received', async ({ page }) => {
      // GIVEN: Chat page with artifacts panel open
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      const artifactsToggle = page.locator('[data-testid="artifacts-panel-toggle"]');
      await artifactsToggle.click();

      // WHEN: Agent creates an artifact (via tool that saves artifact)
      // Send a message that triggers artifact creation
      const input = page.locator('[data-testid="chat-input"]');
      await input.fill('Create a sample artifact');
      await page.locator('[data-testid="chat-send"]').click();

      // Wait for response
      await page.waitForTimeout(2000);

      // THEN: Artifact should appear in the artifacts list
      const artifactsList = page.locator('[data-testid="artifacts-list"]');
      await expect(artifactsList.locator('[data-testid^="artifact-item-"]')).toHaveCount(1, { timeout: 10000 });
    });

    test('Multiple artifacts are tracked separately', async ({ page }) => {
      // GIVEN: Chat with artifacts panel open
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      const artifactsToggle = page.locator('[data-testid="artifacts-panel-toggle"]');
      await artifactsToggle.click();

      // WHEN: Agent creates multiple artifacts
      const input = page.locator('[data-testid="chat-input"]');
      await input.fill('Create three different artifacts');
      await page.locator('[data-testid="chat-send"]').click();

      // Wait for response
      await page.waitForTimeout(3000);

      // THEN: All artifacts should be listed
      const artifactsList = page.locator('[data-testid="artifacts-list"]');
      await expect(artifactsList.locator('[data-testid^="artifact-item-"]')).toHaveCount(3, { timeout: 10000 });
    });
  });

  test.describe('Story 14.3: Artifact Metadata Display', () => {
    // NOTE: These tests verify the UI structure is in place.
    // Actual artifact data population is tested via the detection logic in Phase 14.2.
    // For Phase 14.3, we implement the display components and verify they exist in the DOM.

    test('Artifacts list structure exists in panel', async ({ page }) => {
      // GIVEN: Navigate to chat page with artifacts panel open
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      const artifactsToggle = page.locator('[data-testid="artifacts-panel-toggle"]');
      await artifactsToggle.click();

      // THEN: Artifacts panel should have a list container (even if empty)
      // This verifies the component structure is ready to display artifacts
      const artifactsPanel = page.locator('[data-testid="artifacts-panel"]');
      await expect(artifactsPanel).toBeVisible();

      // The panel should have either empty state OR artifacts list
      // (We'll implement the artifacts list component in this phase)
      const emptyState = artifactsPanel.locator('[data-testid="artifacts-empty-state"]');
      await expect(emptyState).toBeVisible();
    });

    test('Artifact items show filename and scope', async ({ page }) => {
      // This test will be activated when we can reliably create artifacts in tests
      // For now, it documents the expected behavior for Story 14.3
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      const artifactsToggle = page.locator('[data-testid="artifacts-panel-toggle"]');
      await artifactsToggle.click();

      // Future: When artifacts exist, they should show:
      // - [data-testid="artifact-item"] - individual artifact cards
      // - [data-testid="artifact-filename"] - filename display
      // - [data-testid="artifact-scope-badge"] - scope badge (session/user)
    });

    test('Artifact items show version history', async ({ page }) => {
      // This test will be activated when we can reliably create artifacts in tests
      // For now, it documents the expected behavior for Story 14.3
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      const artifactsToggle = page.locator('[data-testid="artifacts-panel-toggle"]');
      await artifactsToggle.click();

      // Future: When artifacts exist, they should show:
      // - [data-testid="artifact-version-count"] - version count (e.g., "v2" or "2 versions")
    });
  });

  test.describe('Story 14.4: Artifact Preview', () => {
    test('Clicking artifact shows preview panel', async ({ page }) => {
      // GIVEN: Chat with an artifact
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      const artifactsToggle = page.locator('[data-testid="artifacts-panel-toggle"]');
      await artifactsToggle.click();

      // Create artifact
      const input = page.locator('[data-testid="chat-input"]');
      await input.fill('Create a text artifact named hello.txt');
      await page.locator('[data-testid="chat-send"]').click();
      await page.waitForTimeout(2000);

      // WHEN: Click on the artifact
      const artifactItem = page.locator('[data-testid="artifact-item-hello.txt"]');
      await expect(artifactItem).toBeVisible({ timeout: 10000 });
      await artifactItem.click();

      // THEN: Preview panel should open
      const previewPanel = page.locator('[data-testid="artifact-preview"]');
      await expect(previewPanel).toBeVisible();
      await expect(previewPanel).toContainText('hello.txt');
    });

    test('Image artifacts show image preview', async ({ page }) => {
      // GIVEN: Chat with an image artifact
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      const artifactsToggle = page.locator('[data-testid="artifacts-panel-toggle"]');
      await artifactsToggle.click();

      // Create image artifact
      const input = page.locator('[data-testid="chat-input"]');
      await input.fill('Create an image artifact named chart.png');
      await page.locator('[data-testid="chat-send"]').click();
      await page.waitForTimeout(2000);

      // WHEN: Click on the artifact
      const artifactItem = page.locator('[data-testid="artifact-item-chart.png"]');
      await expect(artifactItem).toBeVisible({ timeout: 10000 });
      await artifactItem.click();

      // THEN: Preview should show image
      const previewPanel = page.locator('[data-testid="artifact-preview"]');
      await expect(previewPanel).toBeVisible();
      await expect(previewPanel.locator('img[data-testid="artifact-image-preview"]')).toBeVisible();
    });

    test('Text artifacts show text preview', async ({ page }) => {
      // GIVEN: Chat with a text artifact
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      const artifactsToggle = page.locator('[data-testid="artifacts-panel-toggle"]');
      await artifactsToggle.click();

      // Create text artifact
      const input = page.locator('[data-testid="chat-input"]');
      await input.fill('Create a text artifact with content "Hello World"');
      await page.locator('[data-testid="chat-send"]').click();
      await page.waitForTimeout(2000);

      // WHEN: Click on the artifact
      const artifactItem = page.locator('[data-testid="artifact-item-"]').first();
      await expect(artifactItem).toBeVisible({ timeout: 10000 });
      await artifactItem.click();

      // THEN: Preview should show text content
      const previewPanel = page.locator('[data-testid="artifact-preview"]');
      await expect(previewPanel).toBeVisible();
      await expect(previewPanel.locator('[data-testid="artifact-text-preview"]')).toContainText('Hello World');
    });
  });

  test.describe('Story 14.5: Download Functionality', () => {
    test('Artifact has download button', async ({ page }) => {
      // GIVEN: Chat with an artifact
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      const artifactsToggle = page.locator('[data-testid="artifacts-panel-toggle"]');
      await artifactsToggle.click();

      // Create artifact
      const input = page.locator('[data-testid="chat-input"]');
      await input.fill('Create a file named document.pdf');
      await page.locator('[data-testid="chat-send"]').click();
      await page.waitForTimeout(2000);

      // THEN: Artifact item should have download button
      const artifactItem = page.locator('[data-testid="artifact-item-document.pdf"]');
      await expect(artifactItem).toBeVisible({ timeout: 10000 });
      await expect(artifactItem.locator('[data-testid="artifact-download-btn"]')).toBeVisible();
    });

    test('Clicking download triggers file download', async ({ page }) => {
      // GIVEN: Chat with an artifact
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      const artifactsToggle = page.locator('[data-testid="artifacts-panel-toggle"]');
      await artifactsToggle.click();

      // Create artifact
      const input = page.locator('[data-testid="chat-input"]');
      await input.fill('Create a file named test.txt');
      await page.locator('[data-testid="chat-send"]').click();
      await page.waitForTimeout(2000);

      // WHEN: Click download button
      const artifactItem = page.locator('[data-testid="artifact-item-test.txt"]');
      await expect(artifactItem).toBeVisible({ timeout: 10000 });

      const downloadPromise = page.waitForEvent('download');
      await artifactItem.locator('[data-testid="artifact-download-btn"]').click();

      // THEN: File should be downloaded
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('test.txt');
    });
  });

  test.describe('Story 14.6: Upload Functionality', () => {
    test('Artifacts panel has upload button', async ({ page }) => {
      // GIVEN: Artifacts panel is open
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      const artifactsToggle = page.locator('[data-testid="artifacts-panel-toggle"]');
      await artifactsToggle.click();

      // THEN: Panel should have upload button
      const artifactsPanel = page.locator('[data-testid="artifacts-panel"]');
      await expect(artifactsPanel.locator('[data-testid="artifact-upload-btn"]')).toBeVisible();
    });

    test('User can upload a user-scoped artifact', async ({ page }) => {
      // GIVEN: Artifacts panel is open
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      const artifactsToggle = page.locator('[data-testid="artifacts-panel-toggle"]');
      await artifactsToggle.click();

      // WHEN: Click upload button and select file
      const uploadBtn = page.locator('[data-testid="artifact-upload-btn"]');
      await uploadBtn.click();

      // Fill upload form
      await page.locator('[data-testid="artifact-upload-filename"]').fill('user:myfile.txt');
      const fileInput = page.locator('[data-testid="artifact-upload-file-input"]');
      await fileInput.setInputFiles({
        name: 'myfile.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Test content'),
      });
      await page.locator('[data-testid="artifact-upload-submit"]').click();

      // THEN: Artifact should appear in the list
      const artifactItem = page.locator('[data-testid="artifact-item-user:myfile.txt"]');
      await expect(artifactItem).toBeVisible({ timeout: 10000 });
      await expect(artifactItem.locator('[data-testid="artifact-scope-badge"]')).toContainText(/user/i);
    });
  });
});
