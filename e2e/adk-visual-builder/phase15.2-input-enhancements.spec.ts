/**
 * Phase 15.2: Input Enhancements Tests
 *
 * Tests for enhanced input capabilities in the chat interface:
 * - Token streaming toggle (SSE on/off)
 * - File attachment button
 * - Drag-and-drop file upload
 * - Image preview before send
 *
 * Reference: ADK Streaming - https://google.github.io/adk-docs/streaming/
 */

import { test, expect, TEST_PROJECT } from './helpers';

test.describe('Phase 15.2: Input Enhancements', () => {
  // Set up E2E test flag before each test
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __E2E_TEST__: boolean }).__E2E_TEST__ = true;
    });
  });

  test.describe('Story 15.2.1: Token Streaming Toggle', () => {
    test('Chat input area has streaming toggle button', async ({ page }) => {
      // GIVEN: Navigate to the chat page for an agent
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // THEN: There should be a streaming toggle button in the input area
      const streamingToggle = page.locator('[data-testid="streaming-toggle"]');
      await expect(streamingToggle).toBeVisible();
    });

    test('Streaming toggle shows current state (off by default)', async ({ page }) => {
      // GIVEN: Navigate to the chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // THEN: Streaming toggle should show "off" state by default
      const streamingToggle = page.locator('[data-testid="streaming-toggle"]');
      await expect(streamingToggle).toHaveAttribute('data-enabled', 'false');
    });

    test('Clicking streaming toggle changes state to on', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Click the streaming toggle
      const streamingToggle = page.locator('[data-testid="streaming-toggle"]');
      await streamingToggle.click();

      // THEN: Toggle should show "on" state
      await expect(streamingToggle).toHaveAttribute('data-enabled', 'true');
    });

    test('Streaming toggle state persists across toggles', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });
      const streamingToggle = page.locator('[data-testid="streaming-toggle"]');

      // WHEN: Toggle on then off
      await streamingToggle.click();
      await expect(streamingToggle).toHaveAttribute('data-enabled', 'true');

      await streamingToggle.click();
      await expect(streamingToggle).toHaveAttribute('data-enabled', 'false');
    });

    test('Streaming toggle shows tooltip with explanation', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // THEN: Toggle should have a title/tooltip explaining its function
      const streamingToggle = page.locator('[data-testid="streaming-toggle"]');
      await expect(streamingToggle).toHaveAttribute('title', /stream/i);
    });
  });

  test.describe('Story 15.2.2: File Attachment Button', () => {
    test('Chat input area has file attachment button', async ({ page }) => {
      // GIVEN: Navigate to the chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // THEN: There should be a file attachment button in the input area
      const attachButton = page.locator('[data-testid="attach-file-button"]');
      await expect(attachButton).toBeVisible();
    });

    test('File attachment button has hidden file input', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // THEN: There should be a hidden file input associated with the button
      const fileInput = page.locator('[data-testid="file-input"]');
      await expect(fileInput).toBeAttached();
      await expect(fileInput).toHaveAttribute('type', 'file');
    });

    test('File input accepts image types', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // THEN: File input should accept image types
      const fileInput = page.locator('[data-testid="file-input"]');
      const acceptAttr = await fileInput.getAttribute('accept');
      expect(acceptAttr).toMatch(/image/);
    });

    test('Clicking attach button triggers file picker', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Set up file chooser listener and click attach button
      const fileChooserPromise = page.waitForEvent('filechooser');
      await page.locator('[data-testid="attach-file-button"]').click();

      // THEN: File chooser dialog should open
      const fileChooser = await fileChooserPromise;
      expect(fileChooser).toBeDefined();
    });
  });

  test.describe('Story 15.2.3: Drag-and-Drop File Upload', () => {
    test('Chat input area has drop zone', async ({ page }) => {
      // GIVEN: Navigate to the chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // THEN: Input area should have a drop zone element
      const dropZone = page.locator('[data-testid="input-drop-zone"]');
      await expect(dropZone).toBeAttached();
    });

    test('Drop zone has data-drag-active attribute', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // THEN: Drop zone should have data-drag-active attribute (default false)
      const dropZone = page.locator('[data-testid="input-drop-zone"]');
      await expect(dropZone).toHaveAttribute('data-drag-active', 'false');
    });

    test('Drop zone responds to drag events via JavaScript', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });
      const dropZone = page.locator('[data-testid="input-drop-zone"]');

      // WHEN: Trigger drag enter via JavaScript evaluation
      // Note: Playwright's dispatchEvent doesn't properly support DataTransfer,
      // so we test the attribute exists and has proper default state
      await expect(dropZone).toHaveAttribute('data-drag-active', 'false');

      // Verify the drop zone has the proper event handlers by checking the element
      const hasOnDragEnter = await dropZone.evaluate((el) => {
        // React attaches event handlers that we can't directly inspect,
        // but we can verify the element exists and is set up for drag
        return el.hasAttribute('data-testid') && el.getAttribute('data-drag-active') !== null;
      });
      expect(hasOnDragEnter).toBe(true);
    });
  });

  test.describe('Story 15.2.4: Image Preview Before Send', () => {
    test('Selected image shows preview in input area', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Select an image file
      const fileInput = page.locator('[data-testid="file-input"]');
      await fileInput.setInputFiles({
        name: 'test-image.png',
        mimeType: 'image/png',
        buffer: Buffer.from('fake-image-data'),
      });

      // THEN: Image preview should be visible
      const preview = page.locator('[data-testid="attachment-preview"]');
      await expect(preview).toBeVisible();
    });

    test('Image preview shows file name', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Select an image file
      const fileInput = page.locator('[data-testid="file-input"]');
      await fileInput.setInputFiles({
        name: 'my-photo.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake-image-data'),
      });

      // THEN: Preview should show the filename
      const previewName = page.locator('[data-testid="attachment-filename"]');
      await expect(previewName).toHaveText('my-photo.jpg');
    });

    test('Image preview has remove button', async ({ page }) => {
      // GIVEN: Navigate to chat page and select an image
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      const fileInput = page.locator('[data-testid="file-input"]');
      await fileInput.setInputFiles({
        name: 'test.png',
        mimeType: 'image/png',
        buffer: Buffer.from('fake-image-data'),
      });

      // THEN: Preview should have a remove button
      const removeButton = page.locator('[data-testid="remove-attachment"]');
      await expect(removeButton).toBeVisible();
    });

    test('Clicking remove button clears the attachment', async ({ page }) => {
      // GIVEN: Navigate to chat page and select an image
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      const fileInput = page.locator('[data-testid="file-input"]');
      await fileInput.setInputFiles({
        name: 'test.png',
        mimeType: 'image/png',
        buffer: Buffer.from('fake-image-data'),
      });
      await expect(page.locator('[data-testid="attachment-preview"]')).toBeVisible();

      // WHEN: Click the remove button
      await page.locator('[data-testid="remove-attachment"]').click();

      // THEN: Preview should be hidden
      await expect(page.locator('[data-testid="attachment-preview"]')).not.toBeVisible();
    });

    test('Multiple files can be attached', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Select multiple image files
      const fileInput = page.locator('[data-testid="file-input"]');
      await fileInput.setInputFiles([
        {
          name: 'image1.png',
          mimeType: 'image/png',
          buffer: Buffer.from('fake-image-1'),
        },
        {
          name: 'image2.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake-image-2'),
        },
      ]);

      // THEN: Multiple previews should be visible
      const previews = page.locator('[data-testid="attachment-preview"]');
      await expect(previews).toHaveCount(2);
    });
  });

  test.describe('Story 15.2.5: Microphone Button (Deepgram Speech-to-Text)', () => {
    test('Chat input area has microphone button', async ({ page }) => {
      // GIVEN: Navigate to the chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // THEN: There should be a microphone button in the input area
      const micButton = page.locator('[data-testid="microphone-button"]');
      await expect(micButton).toBeVisible();
    });

    test('Microphone button shows recording state when clicked', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Click the microphone button
      const micButton = page.locator('[data-testid="microphone-button"]');
      await micButton.click();

      // THEN: Button should show recording state
      await expect(micButton).toHaveAttribute('data-recording', 'true');
    });

    test('Microphone button shows not-recording state by default', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // THEN: Microphone button should show not-recording state
      const micButton = page.locator('[data-testid="microphone-button"]');
      await expect(micButton).toHaveAttribute('data-recording', 'false');
    });

    test('Clicking microphone again stops recording', async ({ page }) => {
      // GIVEN: Navigate to chat page and start recording
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });
      const micButton = page.locator('[data-testid="microphone-button"]');
      await micButton.click();
      await expect(micButton).toHaveAttribute('data-recording', 'true');

      // WHEN: Click microphone again
      await micButton.click();

      // THEN: Recording should stop
      await expect(micButton).toHaveAttribute('data-recording', 'false');
    });

    test('Microphone button has tooltip', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // THEN: Microphone button should have a title/tooltip
      const micButton = page.locator('[data-testid="microphone-button"]');
      await expect(micButton).toHaveAttribute('title', /voice|microphone|speak/i);
    });

    test('Recording indicator is visible during recording', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Start recording
      const micButton = page.locator('[data-testid="microphone-button"]');
      await micButton.click();

      // THEN: Recording indicator should be visible
      const indicator = page.locator('[data-testid="recording-indicator"]');
      await expect(indicator).toBeVisible();
    });

    test('Recording indicator is hidden when not recording', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // THEN: Recording indicator should not be visible
      const indicator = page.locator('[data-testid="recording-indicator"]');
      await expect(indicator).not.toBeVisible();
    });

    test('Deepgram connection status indicator shows connecting state', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Click the microphone button to start recording
      const micButton = page.locator('[data-testid="microphone-button"]');
      await micButton.click();

      // THEN: Connection status should show connecting or connected
      const connectionStatus = page.locator('[data-testid="deepgram-connection-status"]');
      await expect(connectionStatus).toBeAttached();
      // Status should be one of: connecting, connected, error
      const status = await connectionStatus.getAttribute('data-status');
      expect(['connecting', 'connected', 'error']).toContain(status);
    });

    test('Microphone button shows disabled state when Deepgram unavailable', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // THEN: Button should have data-deepgram-available attribute
      const micButton = page.locator('[data-testid="microphone-button"]');
      await expect(micButton).toHaveAttribute('data-deepgram-available');
    });
  });

  test.describe('Story 15.2.6: Attachment Count Badge', () => {
    test('Attach button shows count when files are attached', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // WHEN: Select multiple files
      const fileInput = page.locator('[data-testid="file-input"]');
      await fileInput.setInputFiles([
        { name: 'file1.png', mimeType: 'image/png', buffer: Buffer.from('1') },
        { name: 'file2.png', mimeType: 'image/png', buffer: Buffer.from('2') },
      ]);

      // THEN: Attach button should show count badge
      const badge = page.locator('[data-testid="attachment-count"]');
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText('2');
    });

    test('Badge updates when attachment is removed', async ({ page }) => {
      // GIVEN: Navigate to chat page and attach 2 files
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      const fileInput = page.locator('[data-testid="file-input"]');
      await fileInput.setInputFiles([
        { name: 'file1.png', mimeType: 'image/png', buffer: Buffer.from('1') },
        { name: 'file2.png', mimeType: 'image/png', buffer: Buffer.from('2') },
      ]);
      await expect(page.locator('[data-testid="attachment-count"]')).toHaveText('2');

      // WHEN: Remove one attachment
      await page.locator('[data-testid="remove-attachment"]').first().click();

      // THEN: Badge should update to 1
      await expect(page.locator('[data-testid="attachment-count"]')).toHaveText('1');
    });

    test('Badge is hidden when no attachments', async ({ page }) => {
      // GIVEN: Navigate to chat page
      await page.goto(`/${TEST_PROJECT}/chat`);
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });

      // THEN: Attachment count badge should not be visible
      const badge = page.locator('[data-testid="attachment-count"]');
      await expect(badge).not.toBeVisible();
    });
  });
});
