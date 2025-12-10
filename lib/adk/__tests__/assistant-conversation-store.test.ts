/**
 * Assistant Conversation Store Tests
 *
 * Tests for persisting assistant conversations per agent.
 * Following TDD: these tests are written first, before implementation.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

// Import the module we're going to create
import {
  saveConversation,
  loadConversation,
  clearConversation,
  type StoredMessage,
} from '../assistant-conversation-store';

describe('Assistant Conversation Store', () => {
  // Mock localStorage for Node.js environment
  let mockStorage: Map<string, string>;

  beforeEach(() => {
    mockStorage = new Map();
    // Inject mock storage for testing
    (global as any).localStorage = {
      getItem: (key: string) => mockStorage.get(key) ?? null,
      setItem: (key: string, value: string) => mockStorage.set(key, value),
      removeItem: (key: string) => mockStorage.delete(key),
      clear: () => mockStorage.clear(),
    };
  });

  describe('saveConversation', () => {
    it('should save messages for an agent', () => {
      const agentName = 'test_agent';
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', content: 'Hello', isComplete: true },
        { id: '2', role: 'assistant', content: 'Hi there!', isComplete: true },
      ];

      saveConversation(agentName, messages);

      const stored = mockStorage.get(`assistant-conversation:${agentName}`);
      assert.ok(stored, 'Conversation should be stored');
      const parsed = JSON.parse(stored);
      assert.deepStrictEqual(parsed, messages);
    });

    it('should overwrite existing conversation for the same agent', () => {
      const agentName = 'test_agent';
      const oldMessages: StoredMessage[] = [
        { id: '1', role: 'user', content: 'Old message', isComplete: true },
      ];
      const newMessages: StoredMessage[] = [
        { id: '2', role: 'user', content: 'New message', isComplete: true },
      ];

      saveConversation(agentName, oldMessages);
      saveConversation(agentName, newMessages);

      const stored = mockStorage.get(`assistant-conversation:${agentName}`);
      const parsed = JSON.parse(stored!);
      assert.deepStrictEqual(parsed, newMessages);
    });

    it('should handle empty message array', () => {
      const agentName = 'test_agent';
      const messages: StoredMessage[] = [];

      saveConversation(agentName, messages);

      const stored = mockStorage.get(`assistant-conversation:${agentName}`);
      assert.ok(stored, 'Empty conversation should still be stored');
      const parsed = JSON.parse(stored);
      assert.deepStrictEqual(parsed, []);
    });
  });

  describe('loadConversation', () => {
    it('should load saved messages for an agent', () => {
      const agentName = 'test_agent';
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', content: 'Hello', isComplete: true },
        { id: '2', role: 'assistant', content: 'Hi!', isComplete: true },
      ];
      mockStorage.set(`assistant-conversation:${agentName}`, JSON.stringify(messages));

      const loaded = loadConversation(agentName);

      assert.deepStrictEqual(loaded, messages);
    });

    it('should return empty array if no conversation exists', () => {
      const loaded = loadConversation('nonexistent_agent');

      assert.deepStrictEqual(loaded, []);
    });

    it('should return empty array if stored data is invalid JSON', () => {
      const agentName = 'test_agent';
      mockStorage.set(`assistant-conversation:${agentName}`, 'invalid json{{{');

      const loaded = loadConversation(agentName);

      assert.deepStrictEqual(loaded, []);
    });
  });

  describe('clearConversation', () => {
    it('should remove conversation for an agent', () => {
      const agentName = 'test_agent';
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', content: 'Hello', isComplete: true },
      ];
      mockStorage.set(`assistant-conversation:${agentName}`, JSON.stringify(messages));

      clearConversation(agentName);

      const stored = mockStorage.get(`assistant-conversation:${agentName}`);
      assert.strictEqual(stored, undefined);
    });

    it('should not throw if conversation does not exist', () => {
      assert.doesNotThrow(() => {
        clearConversation('nonexistent_agent');
      });
    });
  });

  describe('agent isolation', () => {
    it('should keep conversations separate between agents', () => {
      const agent1 = 'agent_one';
      const agent2 = 'agent_two';
      const messages1: StoredMessage[] = [
        { id: '1', role: 'user', content: 'Message for agent 1', isComplete: true },
      ];
      const messages2: StoredMessage[] = [
        { id: '2', role: 'user', content: 'Message for agent 2', isComplete: true },
      ];

      saveConversation(agent1, messages1);
      saveConversation(agent2, messages2);

      const loaded1 = loadConversation(agent1);
      const loaded2 = loadConversation(agent2);

      assert.deepStrictEqual(loaded1, messages1);
      assert.deepStrictEqual(loaded2, messages2);
    });

    it('should only clear conversation for specified agent', () => {
      const agent1 = 'agent_one';
      const agent2 = 'agent_two';
      const messages1: StoredMessage[] = [
        { id: '1', role: 'user', content: 'Message for agent 1', isComplete: true },
      ];
      const messages2: StoredMessage[] = [
        { id: '2', role: 'user', content: 'Message for agent 2', isComplete: true },
      ];

      saveConversation(agent1, messages1);
      saveConversation(agent2, messages2);
      clearConversation(agent1);

      const loaded1 = loadConversation(agent1);
      const loaded2 = loadConversation(agent2);

      assert.deepStrictEqual(loaded1, []);
      assert.deepStrictEqual(loaded2, messages2);
    });
  });

  describe('message structure preservation', () => {
    it('should preserve executedActions in messages', () => {
      const agentName = 'test_agent';
      const messages: StoredMessage[] = [
        {
          id: '1',
          role: 'assistant',
          content: 'I created the agent',
          isComplete: true,
          executedActions: [
            { tool: 'create_agent', status: 'success', message: 'Agent created' },
          ],
        },
      ];

      saveConversation(agentName, messages);
      const loaded = loadConversation(agentName);

      assert.deepStrictEqual(loaded, messages);
      assert.deepStrictEqual(loaded[0].executedActions, messages[0].executedActions);
    });
  });
});
