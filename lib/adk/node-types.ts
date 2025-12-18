/**
 * ADK Agent Node Type Definitions
 *
 * Type definitions for ADK agent YAML parsing and React Flow node representation.
 * Separated from utility functions for better code organization.
 */

export interface AgentFile {
  filename: string;
  yaml: string;
}

export interface GenerationConfig {
  temperature?: number;
  max_output_tokens?: number;
  top_p?: number;
  top_k?: number;
}

// MCP Server types from YAML
export interface MCPStdioParams {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPSseParams {
  url: string;
  headers?: Record<string, string>;
}

export interface MCPToolsetEntry {
  name: 'MCPToolset';
  args: {
    stdio_server_params?: MCPStdioParams;
    sse_server_params?: MCPSseParams;
  };
}

// AgentRefConfig matches ADK's expected format for agent references
export interface AgentRefConfig {
  config_path?: string;
  code?: string;
}

// AgentTool entry for using agents as tools (matches ADK format)
export interface AgentToolEntry {
  name: 'AgentTool';
  args: {
    agent: AgentRefConfig; // Agent reference with config_path or code
    skip_summarization?: boolean;
  };
}

// OpenAPIToolset entry for REST API tools
export interface OpenAPIToolsetEntry {
  name: 'OpenAPIToolset';
  args: {
    name: string; // User-friendly name for the toolset
    spec_url: string; // URL to OpenAPI specification
  };
}

// Built-in tool entry with optional confirmation config and tool-specific args
export interface BuiltInToolEntry {
  name: string;
  require_confirmation?: boolean;
  confirmation_prompt?: string;
  args?: {
    // VertexAiSearchTool
    data_store_id?: string;
    // VertexAiRagRetrieval
    rag_corpora?: string;
    similarity_top_k?: number;
    vector_distance_threshold?: number;
    // FilesRetrieval
    input_dir?: string;
    // LongRunningFunctionTool
    func?: string;
  };
}

// Tool entry can be a string, BuiltInToolEntry, MCPToolset, AgentTool, or OpenAPIToolset
export type ToolEntry = string | BuiltInToolEntry | MCPToolsetEntry | AgentToolEntry | OpenAPIToolsetEntry;

// Callback types
export type CallbackType =
  | 'before_agent'
  | 'after_agent'
  | 'before_model'
  | 'after_model'
  | 'before_tool'
  | 'after_tool';

// Callback entry from YAML
export interface CallbackEntry {
  name: string;
  args?: Array<{ name: string; value: unknown }>;
}

// Parsed callback configuration
export interface CallbackConfig {
  id: string;
  type: CallbackType;
  functionPath: string;
}

export interface ParsedAgent {
  name: string;
  agent_class: string;
  model?: string;
  description?: string;
  instruction?: string;
  tools?: ToolEntry[];
  sub_agents?: Array<{ config_path?: string; name?: string }>;
  generation_config?: GenerationConfig;
  // Callbacks
  before_agent_callbacks?: CallbackEntry[];
  after_agent_callbacks?: CallbackEntry[];
  before_model_callbacks?: CallbackEntry[];
  after_model_callbacks?: CallbackEntry[];
  before_tool_callbacks?: CallbackEntry[];
  after_tool_callbacks?: CallbackEntry[];
}

// Tool config type for extractToolConfigs
export interface ExtractedToolConfig {
  id: string;
  requireConfirmation?: boolean;
  confirmationPrompt?: string;
  // VertexAiSearchTool
  dataStoreId?: string;
  // VertexAiRagRetrieval
  ragCorpora?: string;
  similarityTopK?: number;
  vectorDistanceThreshold?: number;
  // FilesRetrieval
  inputDir?: string;
  // LongRunningFunctionTool
  funcPath?: string;
}

// MCP Server config extracted from tools array
export interface ExtractedMCPServer {
  id: string;
  name: string;
  type: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

// Agent tool extracted from tools array
export interface ExtractedAgentTool {
  id: string;
  agentPath: string;
  agentName: string;
}

// OpenAPI tool extracted from tools array
export interface ExtractedOpenAPITool {
  id: string;
  name: string;
  specUrl: string;
}
