/**
 * Unit Tests for ADK Session Store (lib/adk/session-store.ts)
 *
 * These tests verify USER BEHAVIOR, not implementation details:
 * - When a user clicks "New Session", a new session is created
 * - When a user selects a session, they see its details
 * - When a user deletes a session, it disappears from the list
 * - Session message counts update when messages are sent
 *
 * VERIFICATION REQUIRED:
 * Before removing any E2E tests, run both this file and the E2E tests
 * side-by-side to confirm they test the same user behaviors.
 *
 * Related E2E tests:
 * - e2e/adk-visual-builder/phase15.1-session-management.spec.ts
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { sessionStore } from '../session-store';

describe('ADK Session Store - User Behavior Tests', () => {
  // Clean up sessions between tests
  beforeEach(() => {
    sessionStore.clearAllAgentSessions();
  });

  /**
   * User Behavior: When a user clicks "New Session",
   * a new session is created and added to the list.
   *
   * Related E2E: phase15.1 "User can create a new session"
   */
  describe('User clicks "New Session"', () => {
    it('creates a new session for the agent', () => {
      // User clicks "New Session" for "test-agent"
      const session = sessionStore.createSession('test-agent');

      // Session should be created with correct data
      assert.ok(session.sessionId, 'Session should have an ID');
      assert.strictEqual(session.agentName, 'test-agent');
      assert.strictEqual(session.messageCount, 0);
      assert.ok(session.createdAt, 'Session should have a creation timestamp');
    });

    it('generates unique session IDs', () => {
      const session1 = sessionStore.createSession('test-agent');
      const session2 = sessionStore.createSession('test-agent');

      // Each session should have a unique ID
      assert.notStrictEqual(session1.sessionId, session2.sessionId);
    });

    it('session appears in the sessions list', () => {
      // User creates a session
      const session = sessionStore.createSession('test-agent');

      // Session should appear in the list
      const sessions = sessionStore.getSessions('test-agent');
      assert.strictEqual(sessions.length, 1);
      assert.strictEqual(sessions[0].sessionId, session.sessionId);
    });

    it('multiple sessions can be created for the same agent', () => {
      // User creates multiple sessions
      sessionStore.createSession('test-agent');
      sessionStore.createSession('test-agent');
      sessionStore.createSession('test-agent');

      // All sessions should be in the list
      const sessions = sessionStore.getSessions('test-agent');
      assert.strictEqual(sessions.length, 3);
    });
  });

  /**
   * User Behavior: When a user selects a session,
   * they see its details (ID, timestamp, message count).
   *
   * Related E2E: phase15.1 "Session items show metadata"
   */
  describe('User selects a session', () => {
    it('can retrieve session by ID', () => {
      // User creates a session
      const created = sessionStore.createSession('test-agent');

      // User selects the session
      const retrieved = sessionStore.getSession('test-agent', created.sessionId);

      // Should get the same session back
      assert.ok(retrieved);
      assert.strictEqual(retrieved.sessionId, created.sessionId);
      assert.strictEqual(retrieved.agentName, 'test-agent');
      assert.strictEqual(retrieved.messageCount, 0);
    });

    it('returns undefined for non-existent session', () => {
      const retrieved = sessionStore.getSession('test-agent', 'non-existent-id');
      assert.strictEqual(retrieved, undefined);
    });

    it('session shows created timestamp', () => {
      const session = sessionStore.createSession('test-agent');

      // Timestamp should be a valid ISO date string
      const date = new Date(session.createdAt);
      assert.ok(!isNaN(date.getTime()), 'createdAt should be a valid date');
    });
  });

  /**
   * User Behavior: When a user deletes a session,
   * it disappears from the list.
   *
   * Related E2E: phase15.1 "User can delete a session"
   */
  describe('User deletes a session', () => {
    it('removes the session from the list', () => {
      // User creates a session
      const session = sessionStore.createSession('test-agent');
      assert.strictEqual(sessionStore.getSessions('test-agent').length, 1);

      // User deletes the session
      const deleted = sessionStore.deleteSession('test-agent', session.sessionId);

      // Session should be removed
      assert.strictEqual(deleted, true);
      assert.strictEqual(sessionStore.getSessions('test-agent').length, 0);
    });

    it('returns false when deleting non-existent session', () => {
      const deleted = sessionStore.deleteSession('test-agent', 'non-existent-id');
      assert.strictEqual(deleted, false);
    });

    it('only deletes the specified session', () => {
      // User creates multiple sessions
      const session1 = sessionStore.createSession('test-agent');
      const session2 = sessionStore.createSession('test-agent');
      const session3 = sessionStore.createSession('test-agent');

      // User deletes the middle session
      sessionStore.deleteSession('test-agent', session2.sessionId);

      // Other sessions should still exist
      const remaining = sessionStore.getSessions('test-agent');
      assert.strictEqual(remaining.length, 2);
      assert.ok(remaining.some(s => s.sessionId === session1.sessionId));
      assert.ok(remaining.some(s => s.sessionId === session3.sessionId));
      assert.ok(!remaining.some(s => s.sessionId === session2.sessionId));
    });
  });

  /**
   * User Behavior: When a user sends a message,
   * the session's message count increases.
   *
   * Related E2E: phase15.1 "Message count updates when messages are sent"
   */
  describe('User sends a message', () => {
    it('increments the message count', () => {
      // User creates a session
      const session = sessionStore.createSession('test-agent');
      assert.strictEqual(session.messageCount, 0);

      // User sends a message
      sessionStore.incrementMessageCount('test-agent', session.sessionId);

      // Message count should increase
      const updated = sessionStore.getSession('test-agent', session.sessionId);
      assert.ok(updated);
      assert.strictEqual(updated.messageCount, 1);
    });

    it('counts multiple messages correctly', () => {
      const session = sessionStore.createSession('test-agent');

      // User sends 5 messages
      for (let i = 0; i < 5; i++) {
        sessionStore.incrementMessageCount('test-agent', session.sessionId);
      }

      const updated = sessionStore.getSession('test-agent', session.sessionId);
      assert.ok(updated);
      assert.strictEqual(updated.messageCount, 5);
    });

    it('only increments count for the correct session', () => {
      const session1 = sessionStore.createSession('test-agent');
      const session2 = sessionStore.createSession('test-agent');

      // User sends messages only in session1
      sessionStore.incrementMessageCount('test-agent', session1.sessionId);
      sessionStore.incrementMessageCount('test-agent', session1.sessionId);

      // session1 should have 2 messages, session2 should have 0
      const updated1 = sessionStore.getSession('test-agent', session1.sessionId);
      const updated2 = sessionStore.getSession('test-agent', session2.sessionId);

      assert.ok(updated1);
      assert.ok(updated2);
      assert.strictEqual(updated1.messageCount, 2);
      assert.strictEqual(updated2.messageCount, 0);
    });
  });

  /**
   * User Behavior: Sessions are isolated per agent
   */
  describe('Sessions are per-agent', () => {
    it('different agents have separate session lists', () => {
      // User creates sessions for different agents
      sessionStore.createSession('agent-a');
      sessionStore.createSession('agent-a');
      sessionStore.createSession('agent-b');

      // Each agent should have its own sessions
      assert.strictEqual(sessionStore.getSessions('agent-a').length, 2);
      assert.strictEqual(sessionStore.getSessions('agent-b').length, 1);
      assert.strictEqual(sessionStore.getSessions('agent-c').length, 0);
    });

    it('deleting sessions for one agent does not affect others', () => {
      const sessionA = sessionStore.createSession('agent-a');
      sessionStore.createSession('agent-b');

      // Delete agent-a's session
      sessionStore.deleteSession('agent-a', sessionA.sessionId);

      // agent-b's session should still exist
      assert.strictEqual(sessionStore.getSessions('agent-a').length, 0);
      assert.strictEqual(sessionStore.getSessions('agent-b').length, 1);
    });
  });

  /**
   * Edge cases that could affect user experience
   */
  describe('Edge cases', () => {
    it('getSessions returns empty array for unknown agent', () => {
      const sessions = sessionStore.getSessions('unknown-agent');
      assert.ok(Array.isArray(sessions));
      assert.strictEqual(sessions.length, 0);
    });

    it('incrementMessageCount does nothing for non-existent session', () => {
      // Should not throw
      sessionStore.incrementMessageCount('test-agent', 'non-existent');
      // Just verify it doesn't crash
      assert.ok(true);
    });

    it('clearAllSessions removes all sessions for an agent', () => {
      sessionStore.createSession('test-agent');
      sessionStore.createSession('test-agent');
      sessionStore.createSession('test-agent');

      assert.strictEqual(sessionStore.getSessions('test-agent').length, 3);

      sessionStore.clearAllSessions('test-agent');

      assert.strictEqual(sessionStore.getSessions('test-agent').length, 0);
    });

    it('clearAllAgentSessions removes all sessions for all agents', () => {
      sessionStore.createSession('agent-a');
      sessionStore.createSession('agent-b');
      sessionStore.createSession('agent-c');

      sessionStore.clearAllAgentSessions();

      assert.strictEqual(sessionStore.getSessions('agent-a').length, 0);
      assert.strictEqual(sessionStore.getSessions('agent-b').length, 0);
      assert.strictEqual(sessionStore.getSessions('agent-c').length, 0);
    });

    it('session ID format contains timestamp and random component', () => {
      const session = sessionStore.createSession('test-agent');

      // ID should be in format: timestamp-randomstring
      const parts = session.sessionId.split('-');
      assert.ok(parts.length >= 2, 'Session ID should have multiple parts');

      // First part should be a timestamp (numeric)
      const timestamp = parseInt(parts[0]);
      assert.ok(!isNaN(timestamp), 'First part should be a timestamp');
      assert.ok(timestamp > 0, 'Timestamp should be positive');
    });
  });
});
