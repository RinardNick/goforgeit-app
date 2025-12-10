/**
 * useAssistantConversation Hook Tests
 *
 * Tests for the React hook that manages assistant conversations with persistence.
 * Following TDD: these tests are written first, before implementation.
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

// Mock localStorage for testing
let mockStorage: Map<string, string>;

// Setup mock localStorage before importing the module
beforeEach(() => {
  mockStorage = new Map();
  (global as any).localStorage = {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => mockStorage.set(key, value),
    removeItem: (key: string) => mockStorage.delete(key),
    clear: () => mockStorage.clear(),
  };
});

// Import the hook utilities we're going to create
import {
  loadConversationForAgent,
  saveConversationForAgent,
  clearConversationForAgent,
  type ConversationMessage,
} from '../assistant-conversation-store';

describe('useAssistantConversation Hook Behavior', () => {
  describe('Loading conversation on mount', () => {
    it('should load existing conversation when agent is selected', () => {
      const agentName = 'test_agent';
      const existingMessages: ConversationMessage[] = [
        { id: '1', role: 'user', content: 'Hello', isComplete: true },
        { id: '2', role: 'assistant', content: 'Hi!', isComplete: true },
      ];

      // Pre-populate storage
      mockStorage.set(
        `assistant-conversation:${agentName}`,
        JSON.stringify(existingMessages)
      );

      // Load conversation for the agent
      const loaded = loadConversationForAgent(agentName);

      assert.deepStrictEqual(loaded, existingMessages);
    });

    it('should return empty array for new agent without conversation', () => {
      const agentName = 'new_agent';

      const loaded = loadConversationForAgent(agentName);

      assert.deepStrictEqual(loaded, []);
    });
  });

  describe('Saving conversation after each message', () => {
    it('should save conversation after user sends a message', () => {
      const agentName = 'test_agent';
      const messages: ConversationMessage[] = [
        { id: '1', role: 'user', content: 'Create an agent', isComplete: true },
      ];

      saveConversationForAgent(agentName, messages);

      const stored = mockStorage.get(`assistant-conversation:${agentName}`);
      assert.ok(stored);
      assert.deepStrictEqual(JSON.parse(stored), messages);
    });

    it('should save conversation after assistant responds', () => {
      const agentName = 'test_agent';
      const messages: ConversationMessage[] = [
        { id: '1', role: 'user', content: 'Create an agent', isComplete: true },
        {
          id: '2',
          role: 'assistant',
          content: 'I created the agent for you',
          isComplete: true,
          executedActions: [
            {
              tool: 'create_agent',
              args: { name: 'new_agent' },
              result: { success: true, message: 'Agent created' },
            },
          ],
        },
      ];

      saveConversationForAgent(agentName, messages);

      const stored = mockStorage.get(`assistant-conversation:${agentName}`);
      assert.ok(stored);
      const parsed = JSON.parse(stored);
      assert.strictEqual(parsed.length, 2);
      assert.deepStrictEqual(parsed[1].executedActions, messages[1].executedActions);
    });
  });

  describe('Clearing conversation', () => {
    it('should remove conversation when user clicks clear', () => {
      const agentName = 'test_agent';
      const messages: ConversationMessage[] = [
        { id: '1', role: 'user', content: 'Hello', isComplete: true },
      ];

      // Save a conversation first
      mockStorage.set(
        `assistant-conversation:${agentName}`,
        JSON.stringify(messages)
      );

      // Clear it
      clearConversationForAgent(agentName);

      // Verify it's gone
      const stored = mockStorage.get(`assistant-conversation:${agentName}`);
      assert.strictEqual(stored, undefined);

      // Loading should return empty array
      const loaded = loadConversationForAgent(agentName);
      assert.deepStrictEqual(loaded, []);
    });
  });

  describe('Switching between agents', () => {
    it('should maintain separate conversations for different agents', () => {
      const agent1 = 'agent_one';
      const agent2 = 'agent_two';

      const messages1: ConversationMessage[] = [
        { id: '1', role: 'user', content: 'Message for agent 1', isComplete: true },
      ];
      const messages2: ConversationMessage[] = [
        { id: '2', role: 'user', content: 'Message for agent 2', isComplete: true },
      ];

      // Save conversations for both agents
      saveConversationForAgent(agent1, messages1);
      saveConversationForAgent(agent2, messages2);

      // Verify they're separate
      const loaded1 = loadConversationForAgent(agent1);
      const loaded2 = loadConversationForAgent(agent2);

      assert.deepStrictEqual(loaded1, messages1);
      assert.deepStrictEqual(loaded2, messages2);
    });

    it('should load correct conversation when switching agents', () => {
      const agent1 = 'agent_one';
      const agent2 = 'agent_two';

      const messages1: ConversationMessage[] = [
        { id: '1', role: 'user', content: 'Conversation with agent 1', isComplete: true },
        { id: '2', role: 'assistant', content: 'Response from agent 1 context', isComplete: true },
      ];
      const messages2: ConversationMessage[] = [
        { id: '3', role: 'user', content: 'Different conversation with agent 2', isComplete: true },
      ];

      // Setup conversations
      saveConversationForAgent(agent1, messages1);
      saveConversationForAgent(agent2, messages2);

      // Simulate switching from agent 1 to agent 2
      const currentAgent = agent2;
      const loadedMessages = loadConversationForAgent(currentAgent);

      assert.deepStrictEqual(loadedMessages, messages2);
      assert.notDeepStrictEqual(loadedMessages, messages1);
    });
  });

  describe('Message structure preservation', () => {
    it('should preserve all message properties through save/load cycle', () => {
      const agentName = 'test_agent';
      const complexMessage: ConversationMessage = {
        id: 'complex-1',
        role: 'assistant',
        content: 'I executed some actions',
        isComplete: true,
        executedActions: [
          {
            tool: 'create_agent',
            args: { name: 'new_agent', agentClass: 'LlmAgent' },
            result: {
              success: true,
              message: 'Created agent new_agent',
              data: { filename: 'new_agent.yaml' },
            },
          },
          {
            tool: 'add_tool',
            args: { agentName: 'new_agent', toolName: 'google_search' },
            result: { success: true, message: 'Added tool' },
          },
        ],
      };

      const messages: ConversationMessage[] = [complexMessage];

      saveConversationForAgent(agentName, messages);
      const loaded = loadConversationForAgent(agentName);

      assert.deepStrictEqual(loaded[0], complexMessage);
      assert.strictEqual(loaded[0].executedActions?.length, 2);
      assert.deepStrictEqual(loaded[0].executedActions?.[0].args, { name: 'new_agent', agentClass: 'LlmAgent' });
    });
  });
});
