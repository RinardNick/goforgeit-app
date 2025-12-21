'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  loadConversationForAgent,
  saveConversationForAgent,
  clearConversationForAgent,
  getSessionIdForAgent,
  resetSessionIdForAgent,
} from '@/lib/adk/assistant-conversation-store';

export interface ExecutedAction {
  tool: string;
  args: Record<string, unknown>;
  result: {
    success: boolean;
    message: string;
    data?: Record<string, unknown>;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  executedActions?: ExecutedAction[];
  isComplete?: boolean;
}

export interface UseAssistantOptions {
  projectName: string;
  apiBasePath?: string;
  currentAgents: Array<{ filename: string; name: string; agentClass: string }>;
  selectedAgent?: { filename: string; name: string } | null;
  onRefreshNeeded?: () => void;
  onToolCall?: (toolName: string, args: Record<string, unknown>, isPartial: boolean) => void;
}

export function useAssistant({
  projectName,
  apiBasePath = '/api/agents',
  currentAgents,
  selectedAgent,
  onRefreshNeeded,
  onToolCall,
}: UseAssistantOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Load conversation and session ID from localStorage when projectName changes
  useEffect(() => {
    if (projectName) {
      const savedMessages = loadConversationForAgent(projectName);
      setMessages(savedMessages as Message[]);
      // Get or create session ID for this project's conversation
      const savedSessionId = getSessionIdForAgent(projectName);
      setSessionId(savedSessionId);
    }
  }, [projectName]);

  // Save conversation to localStorage when messages change
  useEffect(() => {
    if (projectName && messages.length > 0) {
      saveConversationForAgent(projectName, messages);
    }
  }, [projectName, messages]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    const assistantMsgId = `assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
    };
    
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch(`${apiBasePath}/${projectName}/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: sessionId,
          context: {
            agents: currentAgents,
            selectedAgent: selectedAgent,
          },
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start assistant stream');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'text') {
              setMessages(prev => prev.map(m => 
                m.id === assistantMsgId ? { ...m, content: m.content + data.content } : m
              ));
            } else if (data.type === 'tool_call') {
              onToolCall?.(data.tool, data.args, true);
            } else if (data.type === 'tool_response') {
              onToolCall?.(data.tool, data.response as Record<string, unknown>, false);
            } else if (data.type === 'done') {
              setMessages(prev => prev.map(m => 
                m.id === assistantMsgId ? { 
                  ...m, 
                  content: data.response,
                  executedActions: data.executedActions,
                  isComplete: data.isComplete
                } : m
              ));
              
              if (data.executedActions?.length > 0) {
                onRefreshNeeded?.();
                data.executedActions.forEach((action: ExecutedAction) => {
                  onToolCall?.(action.tool, action.args, false);
                });
              }
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch (e) {
            console.error('Error parsing SSE line:', e);
          }
        }
      }
    } catch (error) {
      setMessages(prev => prev.map(m => 
        m.id === assistantMsgId ? { 
          ...m, 
          content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        } : m
      ));
    } finally {
      setIsLoading(false);
    }
  }, [projectName, apiBasePath, sessionId, currentAgents, selectedAgent, messages, isLoading, onRefreshNeeded, onToolCall]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    clearConversationForAgent(projectName);
    const newSessionId = resetSessionIdForAgent(projectName);
    setSessionId(newSessionId);
  }, [projectName]);

  return {
    messages,
    isLoading,
    sessionId,
    sendMessage,
    clearConversation,
    setMessages,
  };
}
