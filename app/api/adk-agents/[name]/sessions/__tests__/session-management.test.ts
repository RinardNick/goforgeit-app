/**
 * Integration Tests for ADK Session Management API
 *
 * Converted from E2E tests (e2e/adk-visual-builder/phase15.1-session-management.spec.ts)
 * Tests the session management API routes directly without browser overhead.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { GET as listSessions, POST as createSession } from '../route';
import { GET as getSession, DELETE as deleteSession, PATCH as updateSession } from '../[sessionId]/route';
import { DELETE as cleanupSessions } from '../cleanup/route';

const TEST_PROJECT = 'marketing-team';

// Helper to create a NextRequest mock
function createMockRequest(method: string, url?: string, body?: unknown) {
  const headers = new Headers();
  headers.set('content-type', 'application/json');

  const request: any = {
    method,
    url: url || `http://localhost:3000/api/adk-agents/${TEST_PROJECT}/sessions`,
    headers,
  };

  if (body) {
    request.json = async () => body;
  }

  return request;
}

// Helper to create params
async function createParams(params: Record<string, string>) {
  return Promise.resolve(params);
}

describe('ADK Session Management - Integration Tests', () => {
  let createdSessionIds: string[] = [];

  beforeEach(async () => {
    // Clean up sessions before each test
    const cleanupReq = createMockRequest('DELETE');
    await cleanupSessions(cleanupReq, { params: createParams({ name: TEST_PROJECT }) });
    createdSessionIds = [];
  });

  afterEach(async () => {
    // Clean up any sessions created during tests
    if (createdSessionIds.length > 0) {
      for (const sessionId of createdSessionIds) {
        try {
          const req = createMockRequest('DELETE');
          await deleteSession(req, { params: createParams({ name: TEST_PROJECT, sessionId }) });
        } catch {
          // Ignore errors during cleanup
        }
      }
      createdSessionIds = [];
    }
  });

  describe('POST /api/adk-agents/[name]/sessions - Create Session', () => {
    it('creates a new session and returns session_id', async () => {
      // WHEN: Create a new session
      const request = createMockRequest('POST');
      const response = await createSession(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should return 200 with session data
      assert.strictEqual(response.status, 200);
      assert.ok(data.session_id, 'Should have session_id');
      assert.strictEqual(data.agent_name, TEST_PROJECT);
      assert.ok(data.user_id, 'Should have user_id');

      // Track for cleanup
      createdSessionIds.push(data.session_id);
    });

    it('creates session with default user ID', async () => {
      // WHEN: Create session
      const request = createMockRequest('POST');
      const response = await createSession(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should use default user ID
      assert.strictEqual(data.user_id, 'default-user');

      createdSessionIds.push(data.session_id);
    });

    it('creates session with empty state', async () => {
      // WHEN: Create session
      const request = createMockRequest('POST');
      const response = await createSession(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: State should be defined (even if empty)
      assert.ok('state' in data, 'Should have state property');

      createdSessionIds.push(data.session_id);
    });
  });

  describe('GET /api/adk-agents/[name]/sessions - List Sessions', () => {
    it('returns empty array when no sessions exist', async () => {
      // WHEN: List sessions
      const request = createMockRequest('GET');
      const response = await listSessions(request, { params: createParams({ name: TEST_PROJECT }) });
      const data = await response.json();

      // THEN: Should return empty sessions array
      assert.strictEqual(response.status, 200);
      assert.ok(Array.isArray(data.sessions), 'Should have sessions array');
      assert.strictEqual(data.sessions.length, 0);
    });

    it('returns list of sessions after creating them', async () => {
      // GIVEN: Create 2 sessions
      const req1 = createMockRequest('POST');
      const res1 = await createSession(req1, { params: createParams({ name: TEST_PROJECT }) });
      const session1 = await res1.json();
      createdSessionIds.push(session1.session_id);

      const req2 = createMockRequest('POST');
      const res2 = await createSession(req2, { params: createParams({ name: TEST_PROJECT }) });
      const session2 = await res2.json();
      createdSessionIds.push(session2.session_id);

      // WHEN: List sessions
      const listReq = createMockRequest('GET');
      const listRes = await listSessions(listReq, { params: createParams({ name: TEST_PROJECT }) });
      const data = await listRes.json();

      // THEN: Should return both sessions
      assert.strictEqual(listRes.status, 200);
      assert.strictEqual(data.sessions.length, 2);
      assert.ok(data.sessions.every((s: any) => s.session_id));
      assert.ok(data.sessions.every((s: any) => s.agent_name === TEST_PROJECT));
    });

    it('returns session metadata including message_count', async () => {
      // GIVEN: Create a session
      const createReq = createMockRequest('POST');
      const createRes = await createSession(createReq, { params: createParams({ name: TEST_PROJECT }) });
      const session = await createRes.json();
      createdSessionIds.push(session.session_id);

      // WHEN: List sessions
      const listReq = createMockRequest('GET');
      const listRes = await listSessions(listReq, { params: createParams({ name: TEST_PROJECT }) });
      const data = await listRes.json();

      // THEN: Should include metadata
      const sessionData = data.sessions[0];
      assert.ok('message_count' in sessionData, 'Should have message_count');
      assert.ok('last_update_time' in sessionData, 'Should have last_update_time');
    });
  });

  describe('DELETE /api/adk-agents/[name]/sessions/[sessionId] - Delete Session', () => {
    it('deletes a session by ID', async () => {
      // GIVEN: Create a session
      const createReq = createMockRequest('POST');
      const createRes = await createSession(createReq, { params: createParams({ name: TEST_PROJECT }) });
      const session = await createRes.json();
      const sessionId = session.session_id;

      // WHEN: Delete the session
      const deleteReq = createMockRequest('DELETE');
      const deleteRes = await deleteSession(deleteReq, {
        params: createParams({ name: TEST_PROJECT, sessionId }),
      });
      const deleteData = await deleteRes.json();

      // THEN: Should return success
      assert.strictEqual(deleteRes.status, 200);
      assert.strictEqual(deleteData.success, true);
      assert.strictEqual(deleteData.sessionId, sessionId);

      // Verify session is deleted by trying to list
      const listReq = createMockRequest('GET');
      const listRes = await listSessions(listReq, { params: createParams({ name: TEST_PROJECT }) });
      const listData = await listRes.json();
      assert.strictEqual(listData.sessions.length, 0);
    });

    it('handles deleting non-existent session', async () => {
      // WHEN: Try to delete non-existent session
      const deleteReq = createMockRequest('DELETE');
      const deleteRes = await deleteSession(deleteReq, {
        params: createParams({ name: TEST_PROJECT, sessionId: 'non-existent-id' }),
      });

      // THEN: Should return error or handle gracefully
      // ADK might return 404 or 500
      assert.ok([200, 404, 500].includes(deleteRes.status));
    });
  });

  describe('GET /api/adk-agents/[name]/sessions/[sessionId] - Get Session', () => {
    it('retrieves session details by ID', async () => {
      // GIVEN: Create a session
      const createReq = createMockRequest('POST');
      const createRes = await createSession(createReq, { params: createParams({ name: TEST_PROJECT }) });
      const session = await createRes.json();
      const sessionId = session.session_id;
      createdSessionIds.push(sessionId);

      // WHEN: Get session details
      const getReq = createMockRequest('GET');
      const getRes = await getSession(getReq, {
        params: createParams({ name: TEST_PROJECT, sessionId }),
      });
      const data = await getRes.json();

      // THEN: Should return session details
      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(data.session_id, sessionId);
      assert.strictEqual(data.agent_name, TEST_PROJECT);
      assert.ok('state' in data, 'Should have state');
      assert.ok('events' in data, 'Should have events array');
    });

    it('returns 404 for non-existent session', async () => {
      // WHEN: Try to get non-existent session
      const getReq = createMockRequest('GET');
      const getRes = await getSession(getReq, {
        params: createParams({ name: TEST_PROJECT, sessionId: 'non-existent-id' }),
      });

      // THEN: Should return 404 or error
      assert.ok([404, 500].includes(getRes.status));
    });
  });

  describe('PATCH /api/adk-agents/[name]/sessions/[sessionId] - Update Session State', () => {
    it('updates session state via PATCH endpoint', async () => {
      // GIVEN: Create a session
      const createReq = createMockRequest('POST');
      const createRes = await createSession(createReq, { params: createParams({ name: TEST_PROJECT }) });
      const session = await createRes.json();
      const sessionId = session.session_id;
      createdSessionIds.push(sessionId);

      // WHEN: Update session state via PATCH
      const patchReq = createMockRequest('PATCH', undefined, {
        stateDelta: { visit_count: 5, user_name: 'Test User' },
      });
      const patchRes = await updateSession(patchReq, {
        params: createParams({ name: TEST_PROJECT, sessionId }),
      });
      const updatedSession = await patchRes.json();

      // THEN: Should return success with updated state
      assert.strictEqual(patchRes.status, 200);
      assert.ok(updatedSession.state, 'Should have state');
      assert.strictEqual(updatedSession.state.visit_count, 5);
      assert.strictEqual(updatedSession.state.user_name, 'Test User');
    });

    it('merges state with existing values', async () => {
      // GIVEN: Create a session with initial state
      const createReq = createMockRequest('POST');
      const createRes = await createSession(createReq, { params: createParams({ name: TEST_PROJECT }) });
      const session = await createRes.json();
      const sessionId = session.session_id;
      createdSessionIds.push(sessionId);

      // Set initial state
      const patch1Req = createMockRequest('PATCH', undefined, {
        stateDelta: { key1: 'value1', key2: 'value2' },
      });
      await updateSession(patch1Req, {
        params: createParams({ name: TEST_PROJECT, sessionId }),
      });

      // WHEN: Update with new key and modify existing key
      const patch2Req = createMockRequest('PATCH', undefined, {
        stateDelta: { key2: 'updated', key3: 'new' },
      });
      const patchRes = await updateSession(patch2Req, {
        params: createParams({ name: TEST_PROJECT, sessionId }),
      });
      const updatedSession = await patchRes.json();

      // THEN: Should merge state (key1 kept, key2 updated, key3 added)
      assert.strictEqual(patchRes.status, 200);
      assert.strictEqual(updatedSession.state.key1, 'value1'); // Kept
      assert.strictEqual(updatedSession.state.key2, 'updated'); // Updated
      assert.strictEqual(updatedSession.state.key3, 'new'); // Added
    });

    it('returns error for non-existent session', async () => {
      // WHEN: Try to update non-existent session
      const patchReq = createMockRequest('PATCH', undefined, {
        stateDelta: { key: 'value' },
      });
      const patchRes = await updateSession(patchReq, {
        params: createParams({ name: TEST_PROJECT, sessionId: 'non-existent-id' }),
      });

      // THEN: Should return 404 or 500 error
      assert.ok([404, 500].includes(patchRes.status));
    });

    it('validates PATCH request body schema', async () => {
      // GIVEN: Create a session
      const createReq = createMockRequest('POST');
      const createRes = await createSession(createReq, { params: createParams({ name: TEST_PROJECT }) });
      const session = await createRes.json();
      const sessionId = session.session_id;
      createdSessionIds.push(sessionId);

      // WHEN: Send PATCH with invalid body (missing stateDelta)
      const patchReq = createMockRequest('PATCH', undefined, {
        invalidField: 'value',
      });
      const patchRes = await updateSession(patchReq, {
        params: createParams({ name: TEST_PROJECT, sessionId }),
      });

      // THEN: Should return validation error
      assert.strictEqual(patchRes.status, 400);
      const errorData = await patchRes.json();
      assert.ok(errorData.error, 'Should have error message');
    });
  });

  describe('DELETE /api/adk-agents/[name]/sessions/cleanup - Cleanup All Sessions', () => {
    it('cleans up all sessions for an agent', async () => {
      // GIVEN: Create multiple sessions
      const req1 = createMockRequest('POST');
      await createSession(req1, { params: createParams({ name: TEST_PROJECT }) });

      const req2 = createMockRequest('POST');
      await createSession(req2, { params: createParams({ name: TEST_PROJECT }) });

      // WHEN: Cleanup all sessions
      const cleanupReq = createMockRequest('DELETE');
      const cleanupRes = await cleanupSessions(cleanupReq, {
        params: createParams({ name: TEST_PROJECT }),
      });

      // THEN: Should succeed
      assert.strictEqual(cleanupRes.status, 200);

      // Verify all sessions are deleted
      const listReq = createMockRequest('GET');
      const listRes = await listSessions(listReq, { params: createParams({ name: TEST_PROJECT }) });
      const listData = await listRes.json();
      assert.strictEqual(listData.sessions.length, 0);

      // Clear tracked session IDs since they're already deleted
      createdSessionIds = [];
    });
  });
});
