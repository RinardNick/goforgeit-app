/**
 * ADK (Agent Development Kit) Client
 *
 * Client library for communicating with the Google ADK backend service.
 * Handles agent listing, session management, and agent execution.
 */

// All requests now go through the ADK router abstraction layer
// The router handles proxying to the ADK backend (http://127.0.0.1:8000)
const ADK_ROUTER_URL = '/api/adk-router';
const ADK_ROUTER_URL_SERVER = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/adk-router`
  : 'http://localhost:3025/api/adk-router';

// Use ADK router for all requests (both server-side and client-side)
// The router provides a single control point for all ADK communication
const getBaseUrl = () => {
  if (typeof window === 'undefined') {
    // Server-side: use absolute URL to call our own router
    return ADK_ROUTER_URL_SERVER;
  }
  // Client-side: use relative URL
  return ADK_ROUTER_URL;
};

/**
 * ADK Agent info from list-apps endpoint
 */
export interface ADKAgent {
  name: string;
  description?: string;
}

/**
 * ADK Session
 */
export interface ADKSession {
  id: string;
  appName: string;
  userId: string;
  state?: Record<string, unknown>;
  events?: ADKRunEvent[];
  lastUpdateTime?: number;
  createdAt?: string;
}

/**
 * ADK Run Request
 */
export interface ADKRunRequest {
  appName: string;
  userId: string;
  sessionId: string;
  newMessage: {
    role: 'user';
    parts: Array<{ text: string }>;
  };
  streaming?: boolean;
}

/**
 * ADK Run Response Event (full format from ADK backend)
 * This matches the actual ADK event structure used by ADK Visual Builder
 */
export interface ADKRunEvent {
  // Event identity
  id: string;
  timestamp: number;
  invocationId: string;
  author: string; // Which agent (e.g., "public_agent", "passcode_agent")

  // Content
  content?: {
    parts?: Array<{
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
    }>;
    role?: string;
  };

  // Model metadata
  modelVersion?: string;
  finishReason?: string;
  usageMetadata?: {
    candidatesTokenCount?: number;
    promptTokenCount?: number;
    totalTokenCount?: number;
    thoughtsTokenCount?: number;
    promptTokensDetails?: Array<{ modality: string; tokenCount: number }>;
    candidatesTokensDetails?: Array<{ modality: string; tokenCount: number }>;
  };
  avgLogprobs?: number;

  // Actions taken by this event
  actions?: {
    stateDelta?: Record<string, unknown>;
    artifactDelta?: Record<string, unknown>;
    transferToAgent?: string;
    requestedAuthConfigs?: Record<string, unknown>;
    requestedToolConfirmations?: Record<string, unknown>;
  };
  longRunningToolIds?: string[];

  // Streaming-specific
  partial?: boolean;
  turnComplete?: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Execution result from ADK
 */
export interface ADKExecutionResult {
  response: string;
  sessionId: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
    status: 'pending' | 'success' | 'error';
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  events?: ADKRunEvent[];
}

/**
 * Check if ADK backend is available
 */
export async function checkADKHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${getBaseUrl()}/list-apps`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * List available ADK agents
 */
export async function listADKAgents(): Promise<string[]> {
  const response = await fetch(`${getBaseUrl()}/list-apps`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to list ADK agents: ${response.statusText}`);
  }

  const agents = await response.json();
  return agents as string[];
}

/**
 * Create a new ADK session
 */
export async function createADKSession(
  appName: string,
  userId: string = 'default-user'
): Promise<ADKSession> {
  const response = await fetch(
    `${getBaseUrl()}/apps/${appName}/users/${userId}/sessions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create ADK session: ${error}`);
  }

  const session = await response.json();
  return {
    id: session.id,
    appName,
    userId,
    state: session.state,
  };
}

/**
 * Get an existing ADK session (includes events/history)
 */
export async function getADKSession(
  appName: string,
  userId: string,
  sessionId: string
): Promise<ADKSession | null> {
  try {
    const response = await fetch(
      `${getBaseUrl()}/apps/${appName}/users/${userId}/sessions/${sessionId}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to get ADK session: ${response.statusText}`);
    }

    const session = await response.json();
    return {
      id: session.id,
      appName,
      userId,
      state: session.state,
      events: session.events || [],
      lastUpdateTime: session.lastUpdateTime,
    };
  } catch {
    return null;
  }
}

/**
 * List sessions for an agent
 */
export async function listADKSessions(
  appName: string,
  userId: string = 'default-user'
): Promise<ADKSession[]> {
  const response = await fetch(
    `${getBaseUrl()}/apps/${appName}/users/${userId}/sessions`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to list ADK sessions: ${response.statusText}`);
  }

  const sessions = await response.json();
  return (sessions || []).map((s: { id: string; state?: Record<string, unknown>; lastUpdateTime?: number; events?: unknown[] }) => ({
    id: s.id,
    appName,
    userId,
    state: s.state,
    lastUpdateTime: s.lastUpdateTime,
    // Count events if available (for message count approximation)
    events: s.events,
  }));
}

/**
 * Delete an ADK session
 */
export async function deleteADKSession(
  appName: string,
  userId: string,
  sessionId: string
): Promise<void> {
  const response = await fetch(
    `${getBaseUrl()}/apps/${appName}/users/${userId}/sessions/${sessionId}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete ADK session: ${response.statusText}`);
  }
}

/**
 * Update session state via PATCH endpoint
 *
 * ADK API: PATCH /apps/{app}/users/{user}/sessions/{session_id}
 * Body: { stateDelta: { key: value } }
 *
 * Use this to update session state without executing the agent.
 * The stateDelta is merged with existing state.
 */
export async function updateADKSession(
  appName: string,
  userId: string,
  sessionId: string,
  stateDelta: Record<string, unknown>
): Promise<ADKSession> {
  const response = await fetch(
    `${getBaseUrl()}/apps/${appName}/users/${userId}/sessions/${sessionId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stateDelta }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update ADK session: ${error}`);
  }

  const session = await response.json();
  return {
    id: session.id,
    appName: session.appName || appName,
    userId: session.userId || userId,
    state: session.state,
    events: session.events,
    lastUpdateTime: session.lastUpdateTime,
  };
}

/**
 * ADK Run Response Event (direct JSON format when streaming=false)
 */
interface ADKDirectResponse {
  modelVersion?: string;
  content?: {
    parts?: Array<{
      text?: string;
      functionCall?: {
        name: string;
        args: Record<string, unknown>;
      };
      functionResponse?: {
        name: string;
        response: unknown;
      };
    }>;
    role?: string;
  };
  finishReason?: string;
  usageMetadata?: {
    candidatesTokenCount?: number;
    promptTokenCount?: number;
    totalTokenCount?: number;
  };
  author?: string;
}

/**
 * Execute an ADK agent (non-streaming)
 */
export async function executeADKAgent(
  appName: string,
  message: string,
  options: {
    userId?: string;
    sessionId?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<ADKExecutionResult> {
  const userId = options.userId || 'default-user';

  // Create or get session
  let sessionId = options.sessionId;
  if (!sessionId) {
    const session = await createADKSession(appName, userId);
    sessionId = session.id;
  }

  // Execute with streaming=false for simpler response handling
  const events: ADKRunEvent[] = [];
  let fullResponse = '';
  const toolCalls: ADKExecutionResult['toolCalls'] = [];

  const response = await fetch(`${getBaseUrl()}/run`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: JSON.stringify({
      app_name: appName,
      user_id: userId,
      session_id: sessionId,
      new_message: {
        role: 'user',
        parts: [{ text: message }],
      },
      streaming: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ADK execution failed: ${error}`);
  }

  // Parse response - ADK returns JSON array directly when streaming=false
  const text = await response.text();

  try {
    // Try parsing as JSON array first (non-streaming response)
    const jsonResponse = JSON.parse(text) as ADKRunEvent[];

    if (Array.isArray(jsonResponse)) {
      // Handle direct JSON array response - these are full ADKRunEvent objects
      for (const event of jsonResponse) {
        // Store the full event object
        events.push(event);

        if (event.content?.parts) {
          for (const part of event.content.parts) {
            if (part.text) {
              fullResponse += part.text;
            }
            if (part.functionCall) {
              toolCalls.push({
                name: part.functionCall.name,
                args: part.functionCall.args,
                status: 'pending',
              });
            }
            if (part.functionResponse) {
              // Find matching tool call and update result
              const matchingCall = toolCalls.find(
                (tc) => tc.name === part.functionResponse?.name
              );
              if (matchingCall) {
                matchingCall.result = part.functionResponse.response;
                matchingCall.status = 'success';
              }
            }
          }
        }
      }
    }
  } catch {
    // Fall back to SSE parsing if not valid JSON
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const eventData = JSON.parse(line.slice(6));
          events.push(eventData);

          // Extract text from content
          if (eventData.content?.parts) {
            for (const part of eventData.content.parts) {
              if (part.text) {
                fullResponse += part.text;
              }
              if (part.functionCall) {
                toolCalls.push({
                  name: part.functionCall.name,
                  args: part.functionCall.args,
                  status: 'pending',
                });
              }
              if (part.functionResponse) {
                // Find matching tool call and update result
                const matchingCall = toolCalls.find(
                  (tc) => tc.name === part.functionResponse.name
                );
                if (matchingCall) {
                  matchingCall.result = part.functionResponse.response;
                  matchingCall.status = 'success';
                }
              }
            }
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    }
  }

  return {
    response: fullResponse,
    sessionId,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    events,
  };
}

/**
 * Execute an ADK agent with streaming response
 *
 * IMPORTANT: Uses /run_sse endpoint (NOT /run with streaming=true)
 * The /run endpoint with streaming flag doesn't work properly - it accepts
 * the first chunk then stops. The dedicated /run_sse endpoint is required
 * for proper SSE streaming.
 */
export async function* executeADKAgentStream(
  appName: string,
  message: string,
  options: {
    userId?: string;
    sessionId?: string;
    headers?: Record<string, string>;
  } = {}
): AsyncGenerator<string, ADKExecutionResult, unknown> {
  const userId = options.userId || 'default-user';

  // Create or get session
  let sessionId = options.sessionId;
  if (!sessionId) {
    const session = await createADKSession(appName, userId);
    sessionId = session.id;
  }

  // Use /run_sse for proper SSE streaming (not /run with streaming flag)
  const response = await fetch(`${getBaseUrl()}/run_sse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: JSON.stringify({
      app_name: appName,
      user_id: userId,
      session_id: sessionId,
      new_message: {
        role: 'user',
        parts: [{ text: message }],
      },
      // Enable token-level streaming for real-time text
      streaming: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ADK execution failed: ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let fullResponse = '';
  const toolCalls: ADKExecutionResult['toolCalls'] = [];
  const events: ADKRunEvent[] = [];
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const eventData = JSON.parse(line.slice(6)) as ADKRunEvent;
            events.push(eventData);

            if (eventData.content?.parts) {
              for (const part of eventData.content.parts) {
                if (part.text) {
                  fullResponse += part.text;
                  yield part.text;
                }
                if (part.functionCall) {
                  toolCalls.push({
                    name: part.functionCall.name,
                    args: part.functionCall.args,
                    status: 'pending',
                  });
                }
              }
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    response: fullResponse,
    sessionId,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    events,
  };
}

/**
 * Get agent YAML configuration (for visual builder)
 */
export async function getADKAgentYAML(appName: string): Promise<string> {
  const response = await fetch(`${getBaseUrl()}/builder/app/${appName}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to get agent YAML: ${response.statusText}`);
  }

  return response.text();
}

/**
 * Save agent YAML configuration
 */
export async function saveADKAgentYAML(
  appName: string,
  yaml: string
): Promise<void> {
  const response = await fetch(`${getBaseUrl()}/builder/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_name: appName,
      yaml_content: yaml,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to save agent YAML: ${error}`);
  }
}
