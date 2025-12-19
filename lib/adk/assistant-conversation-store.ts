/**
 * Assistant Conversation Store
 *
 * Persists assistant conversations per agent using localStorage.
 * Each agent has its own separate conversation that persists
 * until the user explicitly clears it.
 */

/**
 * Represents an executed action by the assistant
 */
export interface ExecutedAction {
  tool: string;
  status: 'success' | 'error';
  message: string;
}

/**
 * Represents a message in the conversation
 */
export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isComplete?: boolean;
  executedActions?: ExecutedAction[];
}

const STORAGE_KEY_PREFIX = 'assistant-conversation:';
const SESSION_KEY_PREFIX = 'assistant-session:';

/**
 * Get the storage key for an agent's conversation
 */
function getStorageKey(agentName: string): string {
  return `${STORAGE_KEY_PREFIX}${agentName}`;
}

/**
 * Get the storage key for an agent's session ID
 */
function getSessionKey(agentName: string): string {
  return `${SESSION_KEY_PREFIX}${agentName}`;
}

/**
 * Generate a new unique session ID for a project
 * Format: builder-{projectName}-{uuid}
 */
function generateSessionId(projectName: string): string {
  const uuid = crypto.randomUUID();
  return `builder-${projectName}-${uuid}`;
}

/**
 * Get or create session ID for an agent's conversation
 * Returns existing session ID or generates a new one
 */
export function getSessionIdForAgent(agentName: string): string {
  if (typeof localStorage === 'undefined') {
    return generateSessionId(agentName);
  }

  const key = getSessionKey(agentName);
  let sessionId = localStorage.getItem(key);

  if (!sessionId) {
    sessionId = generateSessionId(agentName);
    localStorage.setItem(key, sessionId);
  }

  return sessionId;
}

/**
 * Reset session ID for an agent (creates a new session)
 * Call this when the user clears the conversation
 */
export function resetSessionIdForAgent(agentName: string): string {
  if (typeof localStorage === 'undefined') {
    return generateSessionId(agentName);
  }

  const key = getSessionKey(agentName);
  const newSessionId = generateSessionId(agentName);
  localStorage.setItem(key, newSessionId);
  return newSessionId;
}

/**
 * Save conversation messages for an agent
 */
export function saveConversation(agentName: string, messages: StoredMessage[]): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  const key = getStorageKey(agentName);
  localStorage.setItem(key, JSON.stringify(messages));
}

/**
 * Load conversation messages for an agent
 * Returns empty array if no conversation exists or on error
 */
export function loadConversation(agentName: string): StoredMessage[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  const key = getStorageKey(agentName);
  const stored = localStorage.getItem(key);

  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/**
 * Clear conversation for an agent
 */
export function clearConversation(agentName: string): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  const key = getStorageKey(agentName);
  localStorage.removeItem(key);
}

// ============================================================================
// Aliases for React hook usage
// ============================================================================

/**
 * ConversationMessage type - matches the Message interface in AIAssistantPanel
 * Uses 'unknown' for executedActions since the structure varies
 */
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isComplete?: boolean;
  executedActions?: unknown[];
}

/**
 * Load conversation for an agent (alias for loadConversation)
 */
export function loadConversationForAgent(agentName: string): ConversationMessage[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  const key = `assistant-conversation:${agentName}`;
  const stored = localStorage.getItem(key);

  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/**
 * Save conversation for an agent (alias for saveConversation)
 */
export function saveConversationForAgent(agentName: string, messages: ConversationMessage[]): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  const key = `assistant-conversation:${agentName}`;
  localStorage.setItem(key, JSON.stringify(messages));
}

/**
 * Clear conversation for an agent (alias for clearConversation)
 */
export function clearConversationForAgent(agentName: string): void {
  clearConversation(agentName);
}
