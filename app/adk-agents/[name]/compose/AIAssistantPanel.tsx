'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Executed action from the backend
interface ExecutedAction {
  tool: string;
  args: Record<string, unknown>;
  result: {
    success: boolean;
    message: string;
    data?: Record<string, unknown>;
  };
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  executedActions?: ExecutedAction[];
  isComplete?: boolean;
}

interface AIAssistantPanelProps {
  isOpen: boolean;
  projectName: string;
  currentAgents: Array<{ filename: string; name: string; agentClass: string }>;
  selectedAgent?: { filename: string; name: string } | null;
  onRefreshNeeded?: () => void;
}

const SUGGESTION_PROMPTS = [
  'Create a new LLM agent that can search the web',
  'Create a sequential workflow with 3 agents',
  'Add google_search tool to the selected agent',
  'Help me understand agent types',
];

const MIN_WIDTH = 320;
const MAX_WIDTH = 700;
const DEFAULT_WIDTH = 400;

// Tool icons for display
const TOOL_ICONS: Record<string, string> = {
  create_agent: '🆕',
  add_sub_agent: '🔗',
  add_tool: '🔧',
  modify_agent: '✏️',
  create_python_tool: '🐍',
  list_agents: '📋',
  read_agent: '📖',
  task_complete: '✅',
};

export function AIAssistantPanel({
  isOpen,
  projectName,
  currentAgents,
  selectedAgent,
  onRefreshNeeded,
}: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle resize drag
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return;

      // Calculate new width based on how far from the right edge of the viewport
      const newWidth = window.innerWidth - e.clientX;

      // Clamp width between min and max
      const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
      setPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Change cursor while resizing
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Call the AI assistant API
      const response = await fetch(`/api/adk-agents/${projectName}/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          context: {
            agents: currentAgents,
            selectedAgent: selectedAgent,
          },
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        executedActions: data.executedActions,
        isComplete: data.isComplete,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If any actions were executed, trigger a refresh of the canvas
      if (data.executedActions && data.executedActions.length > 0) {
        onRefreshNeeded?.();
      }
    } catch (error) {
      const errorMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      data-testid="ai-assistant-panel"
      className="border-l border-gray-200 bg-white flex flex-col relative overflow-hidden"
      style={{ width: panelWidth, height: 'calc(100vh - 140px)', minHeight: '500px' }}
    >
      {/* Resize Handle */}
      <div
        data-testid="ai-assistant-resize-handle"
        onMouseDown={handleResizeStart}
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-400 transition-colors z-10 ${
          isResizing ? 'bg-blue-500' : 'bg-transparent hover:bg-blue-300'
        }`}
      />

      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          AI Builder Assistant
        </h3>
        {selectedAgent && (
          <div
            data-testid="ai-assistant-context"
            className="mt-2 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded"
          >
            Selected: <span className="font-medium">{selectedAgent.name}</span>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div data-testid="ai-assistant-welcome">
            <div className="text-center text-gray-500 mb-4">
              <svg className="w-12 h-12 mx-auto text-blue-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="text-sm font-medium">How can I help you build?</p>
              <p className="text-xs mt-1">I can create agents, add tools, set up workflows, and more.</p>
            </div>

            {/* Suggestion Chips */}
            <div data-testid="ai-assistant-suggestions" className="space-y-2">
              {SUGGESTION_PROMPTS.map((suggestion, index) => (
                <button
                  key={index}
                  data-testid="ai-assistant-suggestion"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div data-testid="ai-assistant-messages" className="space-y-4">
            {messages.map((message) => (
              <div key={message.id}>
                <div
                  data-testid={message.role === 'assistant' ? 'assistant-message' : 'user-message'}
                  className={`${
                    message.role === 'user'
                      ? 'ml-8 bg-blue-50 text-blue-900'
                      : 'mr-4 bg-gray-50 text-gray-900'
                  } p-3 rounded-lg text-sm`}
                >
                  {message.role === 'assistant' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Headings
                        h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h3>,
                        // Paragraphs
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        // Lists
                        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="ml-2">{children}</li>,
                        // Code
                        code: ({ className, children }) => {
                          const isInline = !className;
                          if (isInline) {
                            return <code className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs font-mono">{children}</code>;
                          }
                          return (
                            <code className="block bg-gray-800 text-gray-100 p-2 rounded text-xs font-mono overflow-x-auto my-2">
                              {children}
                            </code>
                          );
                        },
                        pre: ({ children }) => <pre className="my-2">{children}</pre>,
                        // Tables (GFM)
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-2">
                            <table className="min-w-full border border-gray-300 text-xs">{children}</table>
                          </div>
                        ),
                        thead: ({ children }) => <thead className="bg-gray-200">{children}</thead>,
                        tbody: ({ children }) => <tbody>{children}</tbody>,
                        tr: ({ children }) => <tr className="border-b border-gray-300">{children}</tr>,
                        th: ({ children }) => <th className="px-2 py-1 text-left font-semibold border-r border-gray-300 last:border-r-0">{children}</th>,
                        td: ({ children }) => <td className="px-2 py-1 border-r border-gray-300 last:border-r-0">{children}</td>,
                        // Links
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {children}
                          </a>
                        ),
                        // Blockquotes
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-blue-300 pl-3 my-2 italic text-gray-600">
                            {children}
                          </blockquote>
                        ),
                        // Horizontal rule
                        hr: () => <hr className="my-3 border-gray-300" />,
                        // Strong and emphasis
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  ) : (
                    message.content
                  )}
                </div>

                {/* Show executed actions for assistant messages */}
                {message.role === 'assistant' && message.executedActions && message.executedActions.length > 0 && (
                  <div className="mt-2 mr-4 space-y-1" data-testid="executed-actions">
                    <div className="text-xs font-medium text-gray-500 mb-1">Actions executed:</div>
                    {message.executedActions.map((action, idx) => (
                      <div
                        key={idx}
                        className={`text-xs p-2 rounded border ${
                          action.result.success
                            ? 'bg-green-50 border-green-200 text-green-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                        data-testid="executed-action-item"
                      >
                        <div className="flex items-center gap-1 font-medium">
                          <span>{TOOL_ICONS[action.tool] || '🔄'}</span>
                          <span>{action.tool}</span>
                          {action.result.success ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-red-600">✗</span>
                          )}
                        </div>
                        <div className="mt-1 text-gray-600">{action.result.message}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Show completion badge */}
                {message.role === 'assistant' && message.isComplete && (
                  <div className="mt-2 mr-4">
                    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Task completed
                    </span>
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div data-testid="ai-assistant-loading" className="mr-4 bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Working on your request...
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            data-testid="ai-assistant-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me to create agents, add tools, or help with your workflow..."
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
          />
          <button
            data-testid="ai-assistant-send"
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
