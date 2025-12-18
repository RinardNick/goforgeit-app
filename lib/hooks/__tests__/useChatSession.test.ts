import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatSession } from '../useChatSession';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useChatSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with empty messages and no session', () => {
      const { result } = renderHook(() =>
        useChatSession({ agentName: 'test-agent', apiBasePath: '/api/agents' })
      );

      expect(result.current.messages).toEqual([]);
      expect(result.current.sessionId).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should accept custom apiBasePath for agents route', () => {
      const { result } = renderHook(() =>
        useChatSession({ agentName: 'test-agent', apiBasePath: '/api/agents' })
      );

      expect(result.current.apiBasePath).toBe('/api/agents');
    });

    it('should accept custom apiBasePath for adk-agents route', () => {
      const { result } = renderHook(() =>
        useChatSession({ agentName: 'test-agent', apiBasePath: '/api/adk-agents' })
      );

      expect(result.current.apiBasePath).toBe('/api/adk-agents');
    });
  });

  describe('session management', () => {
    it('should fetch sessions on loadSessions call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [
            { session_id: 'sess-1', created_at: '2024-01-01T00:00:00Z' },
            { session_id: 'sess-2', created_at: '2024-01-02T00:00:00Z' },
          ],
        }),
      });

      const { result } = renderHook(() =>
        useChatSession({ agentName: 'test-agent', apiBasePath: '/api/agents' })
      );

      await act(async () => {
        await result.current.loadSessions();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/agents/test-agent/sessions');
      expect(result.current.sessions).toHaveLength(2);
    });

    it('should use adk-agents path when configured', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: [] }),
      });

      const { result } = renderHook(() =>
        useChatSession({ agentName: 'my-agent', apiBasePath: '/api/adk-agents' })
      );

      await act(async () => {
        await result.current.loadSessions();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/adk-agents/my-agent/sessions');
    });

    it('should create a new session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'new-sess-123' }),
      });

      const { result } = renderHook(() =>
        useChatSession({ agentName: 'test-agent', apiBasePath: '/api/agents' })
      );

      await act(async () => {
        await result.current.createSession();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/agents/test-agent/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(result.current.sessionId).toBe('new-sess-123');
    });

    it('should delete a session', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() =>
        useChatSession({ agentName: 'test-agent', apiBasePath: '/api/agents' })
      );

      await act(async () => {
        await result.current.deleteSession('sess-to-delete');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/agents/test-agent/sessions/sess-to-delete',
        { method: 'DELETE' }
      );
    });
  });

  describe('message handling', () => {
    it('should send a message and update messages array', async () => {
      // Mock create session
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'sess-1' }),
      });

      // Mock execute
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Hello from agent',
          tool_calls: [],
        }),
      });

      const { result } = renderHook(() =>
        useChatSession({ agentName: 'test-agent', apiBasePath: '/api/agents' })
      );

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].role).toBe('user');
      expect(result.current.messages[0].content).toBe('Hello');
      expect(result.current.messages[1].role).toBe('assistant');
      expect(result.current.messages[1].content).toBe('Hello from agent');
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'sess-1' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Something went wrong' }),
      });

      const { result } = renderHook(() =>
        useChatSession({ agentName: 'test-agent', apiBasePath: '/api/agents' })
      );

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should set loading state during message send', async () => {
      let resolveExecute: (value: unknown) => void;
      const executePromise = new Promise((resolve) => {
        resolveExecute = resolve;
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ session_id: 'sess-1' }),
        })
        .mockImplementationOnce(() => executePromise);

      const { result } = renderHook(() =>
        useChatSession({ agentName: 'test-agent', apiBasePath: '/api/agents' })
      );

      // Start sending without awaiting
      act(() => {
        result.current.sendMessage('Hello');
      });

      // Check loading is true
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Resolve the execute call
      await act(async () => {
        resolveExecute!({
          ok: true,
          json: async () => ({ response: 'Hi', tool_calls: [] }),
        });
      });

      // Check loading is false after completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('clearing state', () => {
    it('should clear messages when switching sessions', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ session_id: 'sess-1' }),
      });

      const { result } = renderHook(() =>
        useChatSession({ agentName: 'test-agent', apiBasePath: '/api/agents' })
      );

      // Add some messages first
      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      // Clear messages
      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toEqual([]);
    });
  });
});
