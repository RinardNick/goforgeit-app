'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  loadConversationForAgent,
  saveConversationForAgent,
  clearConversationForAgent,
  getSessionIdForAgent,
  resetSessionIdForAgent,
} from '@/lib/adk/assistant-conversation-store';

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

export interface AIAssistantPanelProps {
  isOpen: boolean;
  projectName: string;
  currentAgents: Array<{ filename: string; name: string; agentClass: string }>;
  selectedAgent?: { filename: string; name: string } | null;
  onRefreshNeeded?: () => void;
  /** API base path for the assistant endpoint (e.g., '/api/agents' or '/api/adk-agents') */
  apiBasePath?: string;
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

// Tool icons and display names
const TOOL_CONFIG: Record<string, { icon: string; label: string }> = {
  // Legacy tools
  create_agent: { icon: '🆕', label: 'Create Agent' },
  add_sub_agent: { icon: '🔗', label: 'Add Sub-Agent' },
  add_tool: { icon: '🔧', label: 'Add Tool' },
  modify_agent: { icon: '✏️', label: 'Modify Agent' },
  create_python_tool: { icon: '🐍', label: 'Create Python Tool' },
  list_agents: { icon: '📋', label: 'List Agents' },
  read_agent: { icon: '📖', label: 'Read Agent' },
  task_complete: { icon: '✅', label: 'Complete' },
  // Builder agent tools (Google ADK)
  'builder_agent.tools.read_config_files.read_config_files': { icon: '📖', label: 'Read Config' },
  'builder_agent.tools.write_config_files.write_config_files': { icon: '💾', label: 'Write Config' },
  'builder_agent.tools.explore_project.explore_project': { icon: '🔍', label: 'Explore Project' },
  'builder_agent.tools.read_files.read_files': { icon: '📄', label: 'Read Files' },
  'builder_agent.tools.write_files.write_files': { icon: '✏️', label: 'Write Files' },
  'builder_agent.tools.delete_files.delete_files': { icon: '🗑️', label: 'Delete Files' },
  'builder_agent.tools.cleanup_unused_files.cleanup_unused_files': { icon: '🧹', label: 'Cleanup' },
  'builder_agent.tools.search_adk_source.search_adk_source': { icon: '🔎', label: 'Search Source' },
  'builder_agent.tools.search_adk_knowledge.search_adk_knowledge': { icon: '📚', label: 'Search Knowledge' },
};

// Helper to get tool display info
function getToolDisplay(toolName: string): { icon: string; label: string } {
  // Direct match
  if (TOOL_CONFIG[toolName]) {
    return TOOL_CONFIG[toolName];
  }
  // Try to extract the last part of the tool name (e.g., "read_config_files" from full path)
  const parts = toolName.split('.');
  const shortName = parts[parts.length - 1];
  if (TOOL_CONFIG[shortName]) {
    return TOOL_CONFIG[shortName];
  }
  // Fallback: format the tool name nicely
  return {
    icon: '⚙️',
    label: shortName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  };
}

export function AIAssistantPanel({
  isOpen,
  projectName,
  currentAgents,
  selectedAgent,
  onRefreshNeeded,
  apiBasePath = '/api/agents',
}: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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
      // Call the AI assistant API using the configurable base path
      const response = await fetch(`${apiBasePath}/${projectName}/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: sessionId,  // Pass session ID for conversation continuity
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

  const handleClearConversation = () => {
    setMessages([]);
    clearConversationForAgent(projectName);
    // Reset session ID so the next conversation starts fresh in ADK
    const newSessionId = resetSessionIdForAgent(projectName);
    setSessionId(newSessionId);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      data-testid="ai-assistant-panel"
      className="border-l border-border bg-background flex flex-col relative overflow-hidden transition-colors"
      style={{ width: panelWidth, height: 'calc(100vh - 140px)', minHeight: '500px' }}
    >
      {/* Resize Handle */}
      <div
        data-testid="ai-assistant-resize-handle"
        onMouseDown={handleResizeStart}
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/50 transition-colors z-10 ${
          isResizing ? 'bg-primary' : 'bg-transparent hover:bg-primary/30'
        }`}
      />

      {/* Header */}
      <div className="p-4 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-bold text-foreground flex items-center gap-2 uppercase tracking-wide text-sm">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI Architect
          </h3>
          {messages.length > 0 && (
            <button
              data-testid="ai-assistant-clear"
              onClick={handleClearConversation}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent transition-colors"
              title="Clear conversation"
            >
              Clear
            </button>
          )}
        </div>
        {selectedAgent && (
          <div
            data-testid="ai-assistant-context"
            className="mt-2 text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded border border-border"
          >
            Context: <span className="font-medium text-primary">{selectedAgent.name}</span>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-background">
        {messages.length === 0 ? (
          <div data-testid="ai-assistant-welcome">
            <div className="text-center text-muted-foreground/60 mb-8 mt-4">
              <div className="w-12 h-12 mx-auto bg-muted/30 rounded-full flex items-center justify-center mb-3 text-primary border border-border">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground">Ready to architect.</p>
              <p className="text-xs mt-1">Initialize agents, configure tools, or design workflows.</p>
            </div>

            {/* Suggestion Chips */}
            <div data-testid="ai-assistant-suggestions" className="space-y-2">
              {SUGGESTION_PROMPTS.map((suggestion, index) => (
                <button
                  key={index}
                  data-testid="ai-assistant-suggestion"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-3 py-2 text-xs text-muted-foreground bg-card border border-border hover:bg-accent hover:border-primary/30 hover:text-foreground rounded-sm transition-all duration-200 font-mono"
                >
                  {'>'} {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div data-testid="ai-assistant-messages" className="space-y-6">
            {messages.map((message) => (
              <div key={message.id}>
                <div
                  data-testid={message.role === 'assistant' ? 'assistant-message' : 'user-message'}
                  className={`${
                    message.role === 'user'
                      ? 'ml-8 bg-primary/10 border border-primary/20 text-foreground'
                      : 'mr-4 bg-muted/30 border border-border text-muted-foreground'
                  } p-4 rounded-sm text-sm font-sans leading-relaxed shadow-sm transition-colors`}
                >
                  {message.role === 'assistant' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Headings
                        h1: ({ children }) => <h1 className="text-lg font-bold font-heading text-foreground mb-3 mt-4 first:mt-0">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold font-heading text-foreground mb-2 mt-3 first:mt-0">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-bold font-heading text-foreground mb-2 mt-3 first:mt-0">{children}</h3>,
                        // Paragraphs
                        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                        // Lists
                        ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1 marker:text-primary">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1 marker:text-primary">{children}</ol>,
                        li: ({ children }) => <li className="ml-2">{children}</li>,
                        // Code
                        code: ({ className, children }) => {
                          const isInline = !className;
                          if (isInline) {
                            return <code className="bg-muted border border-border text-primary px-1 py-0.5 rounded text-xs font-mono">{children}</code>;
                          }
                          return (
                            <code className="block bg-muted/50 border border-border text-foreground p-3 rounded-sm text-xs font-mono overflow-x-auto my-3">
                              {children}
                            </code>
                          );
                        },
                        pre: ({ children }) => <pre className="my-2">{children}</pre>,
                        // Tables (GFM)
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-3">
                            <table className="min-w-full border border-border text-xs">{children}</table>
                          </div>
                        ),
                        thead: ({ children }) => <thead className="bg-muted text-foreground">{children}</thead>,
                        tbody: ({ children }) => <tbody>{children}</tbody>,
                        tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
                        th: ({ children }) => <th className="px-3 py-2 text-left font-semibold border-r border-border last:border-r-0">{children}</th>,
                        td: ({ children }) => <td className="px-3 py-2 border-r border-border last:border-r-0">{children}</td>,
                        // Links
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline hover:text-primary/80">
                            {children}
                          </a>
                        ),
                        // Blockquotes
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-2 border-primary pl-3 my-3 italic text-muted-foreground/80">
                            {children}
                          </blockquote>
                        ),
                        // Horizontal rule
                        hr: () => <hr className="my-4 border-border" />,
                        // Strong and emphasis
                        strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                        em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
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
                  <div className="mt-3 mr-4" data-testid="executed-actions">
                    <div className="flex flex-wrap gap-1.5">
                      {message.executedActions.map((action, idx) => {
                        const toolDisplay = getToolDisplay(action.tool);
                        return (
                          <div
                            key={idx}
                            className={`group relative inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono transition-all ${
                              action.result.success
                                ? 'bg-success/10 text-success border border-success/20 hover:bg-success/15'
                                : 'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15'
                            }`}
                            data-testid="executed-action-item"
                            title={action.result.message}
                          >
                            <span className="text-xs">{toolDisplay.icon}</span>
                            <span className="font-medium">{toolDisplay.label}</span>
                            {action.result.success ? (
                              <span className="text-success/80">✓</span>
                            ) : (
                              <span className="text-destructive/80">✗</span>
                            )}
                            {/* Tooltip with full message on hover */}
                            <div className="absolute bottom-full left-0 mb-1 px-2 py-1 bg-popover border border-border rounded shadow-lg text-[10px] text-popover-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 max-w-[200px] truncate">
                              {action.result.message}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Show completion badge */}
                {message.role === 'assistant' && message.isComplete && (
                  <div className="mt-2 mr-4 pl-1">
                    <span className="inline-flex items-center gap-1.5 text-[10px] bg-success/10 border border-success/20 text-success px-2 py-0.5 rounded-full font-mono uppercase tracking-wide">
                      <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                      Task completed
                    </span>
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div data-testid="ai-assistant-loading" className="mr-4 bg-muted/20 border border-border p-3 rounded-sm">
                <div className="flex items-center gap-3 text-muted-foreground text-sm font-mono">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-100"></div>
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-200"></div>
                  </div>
                  <span>Processing...</span>
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border bg-card/80 backdrop-blur-sm">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            data-testid="ai-assistant-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Instruct the Architect..."
            className="flex-1 resize-none bg-background border border-border rounded-sm px-3 py-3 text-sm text-foreground placeholder-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-sans"
            rows={2}
          />
          <button
            data-testid="ai-assistant-send"
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-primary/20"
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
