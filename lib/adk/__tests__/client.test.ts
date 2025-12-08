/**
 * Unit Tests for ADK Client (lib/adk/client.ts)
 *
 * These tests verify USER BEHAVIOR, not implementation details:
 * - When a user sees "ADK Connected" badge, the health check passed
 * - When a user sees list of agents, the API returned them
 * - When a user creates a session, they can chat with the agent
 * - When a user sends a message, they get a response
 *
 * Uses mocked fetch to test client behavior without real API.
 *
 * VERIFICATION REQUIRED:
 * Before removing any E2E tests, run both this file and the E2E tests
 * side-by-side to confirm they test the same user behaviors.
 *
 * Related E2E tests:
 * - e2e/adk-visual-builder/phase13-events-panel.spec.ts
 * - e2e/adk-visual-builder/phase15.1-session-management.spec.ts
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';

// Store original fetch
const originalFetch = globalThis.fetch;

// Mock fetch helper
function mockFetch(responses: Map<string, { ok: boolean; status?: number; json?: unknown; text?: string }>) {
  globalThis.fetch = mock.fn(async (url: string | URL | Request, options?: RequestInit) => {
    const urlStr = url.toString();

    // Find matching response
    for (const [pattern, response] of responses) {
      if (urlStr.includes(pattern)) {
        return {
          ok: response.ok,
          status: response.status || (response.ok ? 200 : 500),
          statusText: response.ok ? 'OK' : 'Error',
          json: async () => response.json,
          text: async () => response.text || JSON.stringify(response.json),
        } as Response;
      }
    }

    // Default: not found
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ error: 'Not found' }),
      text: async () => 'Not found',
    } as Response;
  }) as typeof fetch;
}

// Reset fetch after each test
function resetFetch() {
  globalThis.fetch = originalFetch;
}

describe('ADK Client - User Behavior Tests', () => {
  beforeEach(() => {
    // Reset fetch before each test
    resetFetch();
  });

  afterEach(() => {
    // Ensure fetch is reset after each test
    resetFetch();
  });

  /**
   * User Behavior: User sees "ADK Connected" badge when service is healthy.
   *
   * Related E2E: The ADK Visual Builder shows connection status
   */
  describe('User checks ADK connection status', () => {
    it('returns true when ADK is healthy', async () => {
      mockFetch(
        new Map([
          ['list-apps', { ok: true, json: ['agent1', 'agent2'] }],
        ])
      );

      // Dynamic import to use mocked fetch
      const { checkADKHealth } = await import('../client');
      const isHealthy = await checkADKHealth();

      assert.strictEqual(isHealthy, true);
    });

    it('returns false when ADK is unavailable', async () => {
      mockFetch(
        new Map([
          ['list-apps', { ok: false, status: 503 }],
        ])
      );

      const { checkADKHealth } = await import('../client');
      const isHealthy = await checkADKHealth();

      assert.strictEqual(isHealthy, false);
    });

    it('returns false when fetch throws', async () => {
      globalThis.fetch = mock.fn(async () => {
        throw new Error('Network error');
      }) as typeof fetch;

      const { checkADKHealth } = await import('../client');
      const isHealthy = await checkADKHealth();

      assert.strictEqual(isHealthy, false);
    });
  });

  /**
   * User Behavior: User sees a list of available agents in the UI.
   */
  describe('User views list of agents', () => {
    it('returns list of agent names', async () => {
      mockFetch(
        new Map([
          ['list-apps', { ok: true, json: ['my-agent', 'helper-agent', 'test-agent'] }],
        ])
      );

      const { listADKAgents } = await import('../client');
      const agents = await listADKAgents();

      assert.deepStrictEqual(agents, ['my-agent', 'helper-agent', 'test-agent']);
    });

    it('throws error when API fails', async () => {
      mockFetch(
        new Map([
          ['list-apps', { ok: false, status: 500 }],
        ])
      );

      const { listADKAgents } = await import('../client');

      await assert.rejects(
        async () => await listADKAgents(),
        /Failed to list ADK agents/
      );
    });
  });

  /**
   * User Behavior: User creates a new chat session with an agent.
   *
   * Related E2E: phase15.1 "User can create a new session"
   */
  describe('User creates a chat session', () => {
    it('creates session and returns session data', async () => {
      mockFetch(
        new Map([
          [
            '/sessions',
            {
              ok: true,
              json: {
                id: 'session-123',
                state: {},
              },
            },
          ],
        ])
      );

      const { createADKSession } = await import('../client');
      const session = await createADKSession('my-agent', 'user-1');

      assert.strictEqual(session.id, 'session-123');
      assert.strictEqual(session.appName, 'my-agent');
      assert.strictEqual(session.userId, 'user-1');
    });

    it('uses default user ID if not provided', async () => {
      let capturedUrl = '';
      globalThis.fetch = mock.fn(async (url: string | URL | Request) => {
        capturedUrl = url.toString();
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'session-123' }),
          text: async () => JSON.stringify({ id: 'session-123' }),
        } as Response;
      }) as typeof fetch;

      const { createADKSession } = await import('../client');
      await createADKSession('my-agent');

      assert.ok(capturedUrl.includes('default-user'));
    });

    it('throws error when session creation fails', async () => {
      mockFetch(
        new Map([
          ['/sessions', { ok: false, status: 500, text: 'Internal error' }],
        ])
      );

      const { createADKSession } = await import('../client');

      await assert.rejects(
        async () => await createADKSession('my-agent'),
        /Failed to create ADK session/
      );
    });
  });

  /**
   * User Behavior: User retrieves an existing session.
   */
  describe('User retrieves an existing session', () => {
    it('returns session when it exists', async () => {
      mockFetch(
        new Map([
          [
            'session-123',
            {
              ok: true,
              json: {
                id: 'session-123',
                state: { key: 'value' },
              },
            },
          ],
        ])
      );

      const { getADKSession } = await import('../client');
      const session = await getADKSession('my-agent', 'user-1', 'session-123');

      assert.ok(session);
      assert.strictEqual(session.id, 'session-123');
      assert.deepStrictEqual(session.state, { key: 'value' });
    });

    it('returns null when session does not exist', async () => {
      mockFetch(
        new Map([
          ['session-123', { ok: false, status: 404 }],
        ])
      );

      const { getADKSession } = await import('../client');
      const session = await getADKSession('my-agent', 'user-1', 'session-123');

      assert.strictEqual(session, null);
    });
  });

  /**
   * User Behavior: User lists all sessions for an agent.
   */
  describe('User lists sessions for an agent', () => {
    it('returns list of sessions', async () => {
      mockFetch(
        new Map([
          [
            '/sessions',
            {
              ok: true,
              json: [
                { id: 'session-1', state: {} },
                { id: 'session-2', state: {} },
              ],
            },
          ],
        ])
      );

      const { listADKSessions } = await import('../client');
      const sessions = await listADKSessions('my-agent', 'user-1');

      assert.strictEqual(sessions.length, 2);
      assert.strictEqual(sessions[0].id, 'session-1');
      assert.strictEqual(sessions[1].id, 'session-2');
    });

    it('returns empty array when no sessions exist', async () => {
      mockFetch(
        new Map([
          ['/sessions', { ok: true, json: [] }],
        ])
      );

      const { listADKSessions } = await import('../client');
      const sessions = await listADKSessions('my-agent');

      assert.deepStrictEqual(sessions, []);
    });
  });

  /**
   * User Behavior: User deletes a session.
   *
   * Related E2E: phase15.1 "User can delete a session"
   */
  describe('User deletes a session', () => {
    it('deletes session successfully', async () => {
      mockFetch(
        new Map([
          ['session-123', { ok: true }],
        ])
      );

      const { deleteADKSession } = await import('../client');

      // Should not throw
      await deleteADKSession('my-agent', 'user-1', 'session-123');
      assert.ok(true);
    });

    it('succeeds even if session does not exist (404)', async () => {
      mockFetch(
        new Map([
          ['session-123', { ok: false, status: 404 }],
        ])
      );

      const { deleteADKSession } = await import('../client');

      // Should not throw for 404
      await deleteADKSession('my-agent', 'user-1', 'session-123');
      assert.ok(true);
    });

    it('throws error for other failures', async () => {
      mockFetch(
        new Map([
          ['session-123', { ok: false, status: 500 }],
        ])
      );

      const { deleteADKSession } = await import('../client');

      await assert.rejects(
        async () => await deleteADKSession('my-agent', 'user-1', 'session-123'),
        /Failed to delete ADK session/
      );
    });
  });

  /**
   * User Behavior: User sends a message and gets a response.
   */
  describe('User sends a message to an agent', () => {
    it('executes agent and returns response', async () => {
      // Mock both session creation and run
      globalThis.fetch = mock.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();

        if (urlStr.includes('/sessions') && !urlStr.includes('/run')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 'session-new' }),
            text: async () => JSON.stringify({ id: 'session-new' }),
          } as Response;
        }

        if (urlStr.includes('/run')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              {
                id: 'event-1',
                content: {
                  parts: [{ text: 'Hello! How can I help you?' }],
                },
              },
            ],
            text: async () =>
              JSON.stringify([
                {
                  id: 'event-1',
                  content: {
                    parts: [{ text: 'Hello! How can I help you?' }],
                  },
                },
              ]),
          } as Response;
        }

        return {
          ok: false,
          status: 404,
          json: async () => ({}),
          text: async () => 'Not found',
        } as Response;
      }) as typeof fetch;

      const { executeADKAgent } = await import('../client');
      const result = await executeADKAgent('my-agent', 'Hi there!');

      assert.ok(result.response.includes('Hello'));
      assert.ok(result.sessionId);
    });

    it('uses existing session if provided', async () => {
      let runCalled = false;

      globalThis.fetch = mock.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();

        if (urlStr.includes('/run')) {
          runCalled = true;
          return {
            ok: true,
            status: 200,
            json: async () => [
              {
                id: 'event-1',
                content: { parts: [{ text: 'Response' }] },
              },
            ],
            text: async () =>
              JSON.stringify([
                {
                  id: 'event-1',
                  content: { parts: [{ text: 'Response' }] },
                },
              ]),
          } as Response;
        }

        return {
          ok: false,
          status: 404,
          json: async () => ({}),
          text: async () => 'Not found',
        } as Response;
      }) as typeof fetch;

      const { executeADKAgent } = await import('../client');
      const result = await executeADKAgent('my-agent', 'Test', {
        sessionId: 'existing-session',
      });

      assert.ok(runCalled, 'Should call run endpoint');
      assert.strictEqual(result.sessionId, 'existing-session');
    });

    it('extracts tool calls from response', async () => {
      globalThis.fetch = mock.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();

        if (urlStr.includes('/sessions')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 'session-123' }),
            text: async () => JSON.stringify({ id: 'session-123' }),
          } as Response;
        }

        if (urlStr.includes('/run')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              {
                id: 'event-1',
                content: {
                  parts: [
                    {
                      functionCall: {
                        name: 'google_search',
                        args: { query: 'test' },
                      },
                    },
                  ],
                },
              },
              {
                id: 'event-2',
                content: {
                  parts: [
                    {
                      functionResponse: {
                        name: 'google_search',
                        response: { results: [] },
                      },
                    },
                  ],
                },
              },
              {
                id: 'event-3',
                content: {
                  parts: [{ text: 'Search complete.' }],
                },
              },
            ],
            text: async () =>
              JSON.stringify([
                {
                  id: 'event-1',
                  content: {
                    parts: [
                      {
                        functionCall: {
                          name: 'google_search',
                          args: { query: 'test' },
                        },
                      },
                    ],
                  },
                },
                {
                  id: 'event-2',
                  content: {
                    parts: [
                      {
                        functionResponse: {
                          name: 'google_search',
                          response: { results: [] },
                        },
                      },
                    ],
                  },
                },
                {
                  id: 'event-3',
                  content: {
                    parts: [{ text: 'Search complete.' }],
                  },
                },
              ]),
          } as Response;
        }

        return {
          ok: false,
          status: 404,
          json: async () => ({}),
          text: async () => 'Not found',
        } as Response;
      }) as typeof fetch;

      const { executeADKAgent } = await import('../client');
      const result = await executeADKAgent('my-agent', 'Search for test');

      assert.ok(result.toolCalls);
      assert.strictEqual(result.toolCalls.length, 1);
      assert.strictEqual(result.toolCalls[0].name, 'google_search');
      assert.strictEqual(result.toolCalls[0].status, 'success');
    });

    it('throws error when execution fails', async () => {
      globalThis.fetch = mock.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();

        if (urlStr.includes('/sessions')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 'session-123' }),
            text: async () => JSON.stringify({ id: 'session-123' }),
          } as Response;
        }

        if (urlStr.includes('/run')) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ error: 'Internal error' }),
            text: async () => 'Internal error',
          } as Response;
        }

        return {
          ok: false,
          status: 404,
          json: async () => ({}),
          text: async () => 'Not found',
        } as Response;
      }) as typeof fetch;

      const { executeADKAgent } = await import('../client');

      await assert.rejects(
        async () => await executeADKAgent('my-agent', 'Test'),
        /ADK execution failed/
      );
    });
  });

  /**
   * User Behavior: User sees streaming responses in real-time.
   *
   * CRITICAL: Uses /run_sse endpoint (NOT /run with streaming=true)
   * The /run endpoint with streaming flag doesn't work properly - it accepts
   * the first chunk then stops. The dedicated /run_sse endpoint is required.
   */
  describe('User receives streaming responses', () => {
    it('calls /run_sse endpoint for streaming (not /run)', async () => {
      let capturedUrl = '';

      // Create a mock readable stream
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('data: {"content":{"parts":[{"text":"Hello"}]}}\n\n')
          );
          controller.enqueue(
            new TextEncoder().encode('data: {"content":{"parts":[{"text":" world"}]}}\n\n')
          );
          controller.close();
        },
      });

      globalThis.fetch = mock.fn(async (url: string | URL | Request) => {
        capturedUrl = url.toString();

        if (capturedUrl.includes('/sessions')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 'session-123' }),
            text: async () => JSON.stringify({ id: 'session-123' }),
          } as Response;
        }

        return {
          ok: true,
          status: 200,
          body: mockStream,
          headers: new Headers({ 'Content-Type': 'text/event-stream' }),
        } as Response;
      }) as typeof fetch;

      const { executeADKAgentStream } = await import('../client');
      const generator = executeADKAgentStream('my-agent', 'Test', {
        sessionId: 'existing-session',
      });

      // Consume the generator
      const chunks: string[] = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      // Verify /run_sse was called, NOT /run
      assert.ok(
        capturedUrl.includes('/run_sse'),
        `Expected URL to contain /run_sse but got: ${capturedUrl}`
      );
      assert.ok(
        !capturedUrl.match(/\/run(?!_sse)/),
        `Should not call /run without _sse suffix: ${capturedUrl}`
      );
    });

    it('streams multiple text chunks correctly', async () => {
      // Create a mock readable stream with multiple chunks
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('data: {"content":{"parts":[{"text":"Hello"}]}}\n\n')
          );
          controller.enqueue(
            new TextEncoder().encode('data: {"content":{"parts":[{"text":" "}]}}\n\n')
          );
          controller.enqueue(
            new TextEncoder().encode('data: {"content":{"parts":[{"text":"world"}]}}\n\n')
          );
          controller.enqueue(
            new TextEncoder().encode('data: {"content":{"parts":[{"text":"!"}]}}\n\n')
          );
          controller.close();
        },
      });

      globalThis.fetch = mock.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();

        if (urlStr.includes('/sessions')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 'session-123' }),
            text: async () => JSON.stringify({ id: 'session-123' }),
          } as Response;
        }

        return {
          ok: true,
          status: 200,
          body: mockStream,
          headers: new Headers({ 'Content-Type': 'text/event-stream' }),
        } as Response;
      }) as typeof fetch;

      const { executeADKAgentStream } = await import('../client');
      const generator = executeADKAgentStream('my-agent', 'Test', {
        sessionId: 'existing-session',
      });

      // Collect all chunks
      const chunks: string[] = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      // Verify all chunks were received
      assert.strictEqual(chunks.length, 4, `Expected 4 chunks but got ${chunks.length}`);
      assert.strictEqual(chunks.join(''), 'Hello world!');
    });
  });

  /**
   * User Behavior: User updates session state directly (without executing agent).
   *
   * Use case: Admin updates session variables, initializes state before first message,
   * or corrects state for debugging purposes.
   *
   * ADK API: PATCH /apps/{app}/users/{user}/sessions/{session_id}
   * Body: { stateDelta: { key: value } }
   */
  describe('User updates session state', () => {
    it('updates session state via PATCH and returns updated session', async () => {
      let capturedMethod = '';
      let capturedUrl = '';
      let capturedBody: unknown;

      globalThis.fetch = mock.fn(async (url: string | URL | Request, options?: RequestInit) => {
        capturedUrl = url.toString();
        capturedMethod = options?.method || 'GET';
        if (options?.body) {
          capturedBody = JSON.parse(options.body as string);
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'session-123',
            appName: 'my-agent',
            userId: 'user-1',
            state: { visit_count: 5, existing_key: 'kept' },
            lastUpdateTime: 1743711430.022186,
          }),
          text: async () =>
            JSON.stringify({
              id: 'session-123',
              appName: 'my-agent',
              userId: 'user-1',
              state: { visit_count: 5, existing_key: 'kept' },
              lastUpdateTime: 1743711430.022186,
            }),
        } as Response;
      }) as typeof fetch;

      const { updateADKSession } = await import('../client');
      const session = await updateADKSession('my-agent', 'user-1', 'session-123', {
        visit_count: 5,
      });

      // Verify PATCH method used
      assert.strictEqual(capturedMethod, 'PATCH');

      // Verify correct URL
      assert.ok(capturedUrl.includes('/apps/my-agent/users/user-1/sessions/session-123'));

      // Verify body format matches ADK spec
      assert.deepStrictEqual(capturedBody, { stateDelta: { visit_count: 5 } });

      // Verify returned session has merged state
      assert.strictEqual(session.id, 'session-123');
      assert.strictEqual(session.state?.visit_count, 5);
      assert.strictEqual(session.state?.existing_key, 'kept');
    });

    it('throws error when session update fails', async () => {
      globalThis.fetch = mock.fn(async () => {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ error: 'Update failed' }),
          text: async () => 'Update failed',
        } as Response;
      }) as typeof fetch;

      const { updateADKSession } = await import('../client');

      await assert.rejects(
        async () => await updateADKSession('my-agent', 'user-1', 'session-123', { key: 'value' }),
        /Failed to update ADK session/
      );
    });

    it('throws error when session not found (404)', async () => {
      globalThis.fetch = mock.fn(async () => {
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({ error: 'Session not found' }),
          text: async () => 'Session not found',
        } as Response;
      }) as typeof fetch;

      const { updateADKSession } = await import('../client');

      await assert.rejects(
        async () => await updateADKSession('my-agent', 'user-1', 'nonexistent', { key: 'value' }),
        /Failed to update ADK session/
      );
    });
  });

  /**
   * User Behavior: User gets/saves agent YAML (visual builder).
   */
  describe('User works with agent YAML', () => {
    it('retrieves agent YAML configuration', async () => {
      mockFetch(
        new Map([
          [
            '/builder/app/my-agent',
            {
              ok: true,
              text: 'name: my_agent\nagent_class: LlmAgent',
            },
          ],
        ])
      );

      const { getADKAgentYAML } = await import('../client');
      const yaml = await getADKAgentYAML('my-agent');

      assert.ok(yaml.includes('name: my_agent'));
      assert.ok(yaml.includes('agent_class: LlmAgent'));
    });

    it('throws error when YAML retrieval fails', async () => {
      mockFetch(
        new Map([
          ['/builder/app/my-agent', { ok: false, status: 404 }],
        ])
      );

      const { getADKAgentYAML } = await import('../client');

      await assert.rejects(
        async () => await getADKAgentYAML('my-agent'),
        /Failed to get agent YAML/
      );
    });

    it('saves agent YAML configuration', async () => {
      let savedData: unknown;
      globalThis.fetch = mock.fn(async (url: string | URL | Request, options?: RequestInit) => {
        if (url.toString().includes('/builder/save')) {
          savedData = JSON.parse(options?.body as string);
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
            text: async () => 'OK',
          } as Response;
        }
        return {
          ok: false,
          status: 404,
          json: async () => ({}),
          text: async () => 'Not found',
        } as Response;
      }) as typeof fetch;

      const { saveADKAgentYAML } = await import('../client');
      await saveADKAgentYAML('my-agent', 'name: updated_agent');

      assert.deepStrictEqual(savedData, {
        app_name: 'my-agent',
        yaml_content: 'name: updated_agent',
      });
    });

    it('throws error when YAML save fails', async () => {
      mockFetch(
        new Map([
          ['/builder/save', { ok: false, status: 500, text: 'Save failed' }],
        ])
      );

      const { saveADKAgentYAML } = await import('../client');

      await assert.rejects(
        async () => await saveADKAgentYAML('my-agent', 'invalid yaml'),
        /Failed to save agent YAML/
      );
    });
  });
});
