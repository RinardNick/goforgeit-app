// Database models matching PostgreSQL schema

export enum PostStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
  SCHEDULED = 'SCHEDULED',
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  category: string;
  tags: string[];
  featuredImage: string | null;
  status: PostStatus;
  publishedAt: Date | null;
  scheduledFor: Date | null;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  sharedOnLinkedIn?: boolean;
  sharedOnX?: boolean;
  linkedInShareDate?: Date | null;
  xShareDate?: Date | null;
}

// Join types
export interface PostWithAuthor extends Post {
  author: User;
}

// Input types for creating/updating
export interface CreatePostInput {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  category: string;
  tags?: string[];
  featuredImage?: string;
  status?: PostStatus;
  publishedAt?: Date;
  scheduledFor?: Date;
  authorId: string;
}

export interface UpdatePostInput {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  category?: string;
  tags?: string[];
  featuredImage?: string;
  status?: PostStatus;
  publishedAt?: Date | null;
  scheduledFor?: Date | null;
}

export interface CreateUserInput {
  email: string;
  name?: string;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
}

// Query filters
export interface PostFilter {
  status?: PostStatus;
  category?: string;
  authorId?: string;
  limit?: number;
  offset?: number;
}

// Contact Submissions
export enum ContactSubmissionStatus {
  NEW = 'new',
  READ = 'read',
  ARCHIVED = 'archived',
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactSubmissionStatus;
  sessionId?: string;
  createdAt: Date;
  readAt?: Date;
}

export interface ListContactsOptions {
  status?: ContactSubmissionStatus;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

// Templates
export interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  contentStructure: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateWithAuthor extends Template {
  author: User;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  category: string;
  tags?: string[];
  contentStructure: string;
  authorId: string;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  contentStructure?: string;
}

export interface TemplateFilter {
  category?: string;
  authorId?: string;
  limit?: number;
  offset?: number;
}

// Post Versions
export interface PostVersion {
  id: string;
  postId: string;
  versionNumber: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  category: string;
  tags: string[];
  featuredImage: string | null;
  status: PostStatus;
  publishedAt: Date | null;
  scheduledFor: Date | null;
  changes: string[] | null; // Array of field names that changed
  createdAt: Date;
  createdBy: string;
}

export interface PostVersionWithAuthor extends PostVersion {
  author: User;
}

export interface CreatePostVersionInput {
  postId: string;
  versionNumber: number;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  category: string;
  tags?: string[];
  featuredImage?: string;
  status: PostStatus;
  publishedAt?: Date | null;
  scheduledFor?: Date | null;
  changes?: string[];
  createdBy: string;
}

export interface PostVersionFilter {
  postId: string;
  limit?: number;
  offset?: number;
}

// Agent System Types (Epic 1)

export enum AgentType {
  SIMPLE = 'simple',
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
  ROUTER = 'router',
  LOOP = 'loop',
}

export enum AgentSessionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ERROR = 'error',
}

export enum AgentMessageRole {
  USER = 'user',
  AGENT = 'agent',
  TOOL = 'tool',
  SYSTEM = 'system',
}

export enum AgentTraceEventType {
  START = 'start',
  TOOL_CALL = 'tool_call',
  AGENT_SWITCH = 'agent_switch',
  COMPLETE = 'complete',
  ERROR = 'error',
  LLM_CALL = 'llm_call',
  LLM_RESPONSE = 'llm_response',
}

export enum AgentEvalStatus {
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// Agent tool configuration
export interface AgentToolConfig {
  type: 'function' | 'agent';
  function?: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
  agentId?: string;
  description?: string;
}

// Agent configuration stored in JSONB
export interface AgentConfigJson {
  model: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  tools?: AgentToolConfig[];
  // For workflow agents
  agents?: Array<{
    id: string;
    name: string;
    model: string;
    systemInstruction?: string;
    tools?: string[];
    inputFrom?: string;
  }>;
  // For router agents
  router?: {
    model: string;
    systemInstruction: string;
  };
  routes?: Array<{
    condition: string;
    agentId: string;
  }>;
  // For loop agents
  condition?: {
    type: 'tool_result' | 'max_iterations' | 'llm_decision';
    toolName?: string;
    stopWhen?: Record<string, unknown>;
  };
  maxIterations?: number;
  // For parallel agents
  aggregation?: {
    type: 'llm_synthesis' | 'concatenate' | 'custom_function';
    model?: string;
    instruction?: string;
  };
}

// Agent configuration entity
export interface AgentConfig {
  id: string;
  userId: string | null;
  name: string;
  description: string | null;
  type: AgentType;
  config: AgentConfigJson;
  isPublished: boolean;
  templateId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Agent session entity
export interface AgentSession {
  id: string;
  agentId: string;
  userId: string | null;
  apiKeyId: string | null;
  status: AgentSessionStatus;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

// Agent message entity
export interface AgentMessage {
  id: string;
  sessionId: string;
  role: AgentMessageRole;
  agentName: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// Agent trace entity
export interface AgentTrace {
  id: string;
  sessionId: string;
  messageId: string | null;
  agentId: string;
  eventType: AgentTraceEventType;
  eventData: Record<string, unknown>;
  durationMs: number | null;
  createdAt: Date;
}

// Agent evaluation entity
export interface AgentEvaluation {
  id: string;
  agentId: string;
  name: string;
  description: string | null;
  testCases: Array<{
    input: string;
    expectedOutput?: string;
    criteria?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

// Agent evaluation run entity
export interface AgentEvaluationRun {
  id: string;
  evaluationId: string;
  agentId: string;
  status: AgentEvalStatus;
  results: Array<{
    testCaseIndex: number;
    passed: boolean;
    actualOutput?: string;
    score?: number;
    reason?: string;
  }> | null;
  score: number | null;
  createdAt: Date;
  completedAt: Date | null;
}

// Input types for creating agents
export interface CreateAgentInput {
  name: string;
  description?: string;
  type: AgentType;
  config: AgentConfigJson;
  isPublished?: boolean;
  userId?: string;
  templateId?: string;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  type?: AgentType;
  config?: AgentConfigJson;
  isPublished?: boolean;
}

// Input types for sessions
export interface CreateAgentSessionInput {
  agentId: string;
  userId?: string;
  apiKeyId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateAgentSessionInput {
  status?: AgentSessionStatus;
  metadata?: Record<string, unknown>;
}

// Input types for messages
export interface CreateAgentMessageInput {
  sessionId: string;
  role: AgentMessageRole;
  agentName?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

// Input types for traces
export interface CreateAgentTraceInput {
  sessionId: string;
  messageId?: string;
  agentId: string;
  eventType: AgentTraceEventType;
  eventData: Record<string, unknown>;
  durationMs?: number;
}

// Filter types
export interface AgentFilter {
  userId?: string;
  type?: AgentType;
  isPublished?: boolean;
  limit?: number;
  offset?: number;
}

export interface AgentSessionFilter {
  agentId?: string;
  userId?: string;
  status?: AgentSessionStatus;
  limit?: number;
  offset?: number;
}

export interface AgentMessageFilter {
  sessionId: string;
  role?: AgentMessageRole;
  limit?: number;
  offset?: number;
}

export interface AgentTraceFilter {
  sessionId?: string;
  messageId?: string;
  eventType?: AgentTraceEventType;
  limit?: number;
  offset?: number;
}
