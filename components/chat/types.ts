/**
 * Type definitions for the ADK Agent Chat interface
 */

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'success' | 'error';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  // IDs of events that happened during this response
  eventIds?: string[];
}

// ADK Event types matching the actual ADK backend format
export type EventType = 'text' | 'functionCall' | 'functionResponse' | 'error' | 'system';

export interface ADKEventPart {
  text?: string;
  functionCall?: {
    id?: string;
    name: string;
    args: Record<string, unknown>;
  };
  functionResponse?: {
    id?: string;
    name: string;
    response: unknown;
  };
  thoughtSignature?: string;
}

// Full ADK Event from the backend
export interface ADKEvent {
  id: string;
  timestamp: number;
  invocationId: string;
  author: string;
  content?: {
    parts?: ADKEventPart[];
    role?: string;
  };
  modelVersion?: string;
  finishReason?: string;
  usageMetadata?: {
    candidatesTokenCount?: number;
    promptTokenCount?: number;
    totalTokenCount?: number;
    thoughtsTokenCount?: number;
    candidatesTokensDetails?: Array<{ modality: string; tokenCount: number }>;
    promptTokensDetails?: Array<{ modality: string; tokenCount: number }>;
  };
  avgLogprobs?: number;
  actions?: {
    stateDelta?: Record<string, unknown>;
    artifactDelta?: Record<string, unknown>;
    transferToAgent?: string;
    requestedAuthConfigs?: Record<string, unknown>;
    requestedToolConfirmations?: Record<string, unknown>;
  };
  longRunningToolIds?: string[];
  // Computed fields for display
  eventType: EventType;
  title: string;
  displayContent: string;
}

export type EventFilter = 'all' | 'messages' | 'tools';
export type DetailTab = 'event' | 'request' | 'response';
export type PanelTab = 'sessions' | 'trace' | 'events' | 'state' | 'artifacts';

// State entry for the state viewer
export interface StateEntry {
  key: string;
  value: unknown;
  previousValue?: unknown;
  scope: 'session' | 'user';
  changed: boolean;
}

// Invocation info for grouping events by user message
export interface InvocationInfo {
  invocationId: string;
  userMessage: string;
  timestamp: Date;
  events: ADKEvent[];
  totalTime?: number;
}

// Agent config for Request tab
export interface AgentConfig {
  name: string;
  model: string;
  instruction?: string;
  description?: string;
  subAgents?: string[];
}
