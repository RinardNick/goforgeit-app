'use client';

import { useState, useCallback } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
    status?: 'pending' | 'complete' | 'error';
  }>;
  timestamp: Date;
}

export interface Session {
  sessionId: string;
  createdAt: string;
  messageCount: number;
}

export interface UseChatSessionOptions {
  agentName: string;
  apiBasePath: '/api/agents' | '/api/adk-agents';
  initialSessionId?: string | null;
}

export interface UseChatSessionReturn {
  // State
  messages: Message[];
  sessionId: string | null;
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  apiBasePath: string;

  // Actions
  sendMessage: (content: string, attachments?: Array<{ name: string; type: string; data: string }>) => Promise<void>;
  loadSessions: () => Promise<void>;
  createSession: () => Promise<string | null>;
  deleteSession: (sessionId: string) => Promise<void>;
  switchSession: (sessionId: string) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
}

/**
 * Shared hook for chat functionality that works with both
 * /api/agents and /api/adk-agents routes.
 *
 * This eliminates duplication between the two chat page implementations.
 */
export function useChatSession({
  agentName,
  apiBasePath,
  initialSessionId = null,
}: UseChatSessionOptions): UseChatSessionReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch(`${apiBasePath}/${agentName}/sessions`);
      if (!response.ok) {
        throw new Error('Failed to load sessions');
      }
      const data = await response.json();
      const sessionList = data.sessions || [];

      // Transform to our session format
      const formattedSessions: Session[] = sessionList.map((s: { session_id: string; created_at: string; message_count?: number }) => ({
        sessionId: s.session_id,
        createdAt: s.created_at,
        messageCount: s.message_count || 0,
      }));

      setSessions(formattedSessions);
    } catch (err) {
      console.error('Error loading sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    }
  }, [apiBasePath, agentName]);

  const createSession = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch(`${apiBasePath}/${agentName}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      const newSessionId = data.session_id;
      setSessionId(newSessionId);
      clearMessages();
      return newSessionId;
    } catch (err) {
      console.error('Error creating session:', err);
      setError(err instanceof Error ? err.message : 'Failed to create session');
      return null;
    }
  }, [apiBasePath, agentName, clearMessages]);

  const deleteSession = useCallback(async (sessionToDelete: string) => {
    try {
      const response = await fetch(`${apiBasePath}/${agentName}/sessions/${sessionToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete session');
      }

      // Remove from local state
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionToDelete));

      // If we deleted the current session, clear it
      if (sessionId === sessionToDelete) {
        setSessionId(null);
        clearMessages();
      }
    } catch (err) {
      console.error('Error deleting session:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete session');
    }
  }, [apiBasePath, agentName, sessionId, clearMessages]);

  const switchSession = useCallback(async (newSessionId: string) => {
    setSessionId(newSessionId);
    clearMessages();
    // TODO: Load messages for this session if needed
  }, [clearMessages]);

  const sendMessage = useCallback(async (
    content: string,
    attachments?: Array<{ name: string; type: string; data: string }>
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      // Ensure we have a session
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        currentSessionId = await createSession();
        if (!currentSessionId) {
          throw new Error('Failed to create session');
        }
      }

      // Add user message to state immediately
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Send to API
      const response = await fetch(`${apiBasePath}/${agentName}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          session_id: currentSessionId,
          attachments,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to send message');
      }

      const data = await response.json();

      // Add assistant response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response || '',
        toolCalls: data.tool_calls?.map((tc: { name: string; args: Record<string, unknown>; result?: unknown }) => ({
          name: tc.name,
          args: tc.args,
          result: tc.result,
          status: 'complete' as const,
        })),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }, [apiBasePath, agentName, sessionId, createSession]);

  return {
    // State
    messages,
    sessionId,
    sessions,
    isLoading,
    error,
    apiBasePath,

    // Actions
    sendMessage,
    loadSessions,
    createSession,
    deleteSession,
    switchSession,
    clearMessages,
    clearError,
  };
}
