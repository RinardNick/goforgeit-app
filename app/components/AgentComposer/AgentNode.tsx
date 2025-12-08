'use client';

import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';

// ADK Agent Types
export type ADKAgentClass = 'LlmAgent' | 'SequentialAgent' | 'ParallelAgent' | 'LoopAgent';

// Model generation configuration
export interface GenerationConfig {
  temperature?: number;
  max_output_tokens?: number;
  top_p?: number;
  top_k?: number;
}

// MCP Server configuration
export type MCPServerType = 'stdio' | 'sse';

export interface MCPServerConfig {
  id: string;
  name: string;
  type: MCPServerType;
  // Stdio params
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // SSE params
  url?: string;
  headers?: Record<string, string>;
}

// AgentTool configuration
export interface AgentToolConfig {
  id: string;
  agentPath: string; // e.g., "calculator_agent.yaml"
  agentName: string; // e.g., "calculator_agent" (derived from path)
}

// OpenAPI Tool configuration
export interface OpenAPIToolConfig {
  id: string;
  name: string; // e.g., "petstore_api"
  specUrl: string; // e.g., "https://petstore3.swagger.io/api/v3/openapi.json"
}

// Callback types
export type CallbackType =
  | 'before_agent'
  | 'after_agent'
  | 'before_model'
  | 'after_model'
  | 'before_tool'
  | 'after_tool';

// Callback configuration
export interface CallbackConfig {
  id: string;
  type: CallbackType;
  functionPath: string;
}

// Python Tool configuration
export interface PythonToolConfig {
  id: string;
  name: string;
  filename: string;
  code?: string;
  signature?: {
    name: string;
    params: Array<{
      name: string;
      type: string;
      required: boolean;
      default?: string;
    }>;
    docstring?: string;
    returnType?: string;
  };
  enabled: boolean;
}

export interface ToolConfig {
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

export interface AgentNodeData extends Record<string, unknown> {
  name: string;
  agentClass: ADKAgentClass;
  model?: string;
  description?: string;
  instruction?: string;
  tools?: string[];
  toolConfigs?: Map<string, ToolConfig>; // Tool confirmation configurations
  mcpServers?: MCPServerConfig[];
  agentTools?: AgentToolConfig[]; // Agents used as tools
  openApiTools?: OpenAPIToolConfig[]; // OpenAPI REST API tools
  pythonTools?: PythonToolConfig[]; // Custom Python function tools
  callbacks?: CallbackConfig[]; // Agent callbacks
  subAgents?: string[];
  isRoot?: boolean;
  filename?: string;
  generation_config?: GenerationConfig;
  hasValidationErrors?: boolean; // Indicates if the agent has validation errors
  onAddChildAgent?: (parentNodeId: string, childAgentClass: ADKAgentClass) => void;
}

const agentClassConfig: Record<
  ADKAgentClass,
  { color: string; bgColor: string; icon: string; description: string }
> = {
  LlmAgent: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    icon: '🤖',
    description: 'Single LLM-powered agent',
  },
  SequentialAgent: {
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200',
    icon: '⏭️',
    description: 'Executes sub-agents in order',
  },
  ParallelAgent: {
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
    icon: '⚡',
    description: 'Executes sub-agents concurrently',
  },
  LoopAgent: {
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 border-orange-200',
    icon: '🔄',
    description: 'Iterates over sub-agents',
  },
};

interface AgentNodeProps {
  id: string;
  data: AgentNodeData;
  selected?: boolean;
}

// Agent type dropdown items
const agentTypeDropdownItems: { type: ADKAgentClass; label: string; icon: string }[] = [
  { type: 'LlmAgent', label: 'LLM Agent', icon: '🤖' },
  { type: 'SequentialAgent', label: 'Sequential', icon: '⏭️' },
  { type: 'ParallelAgent', label: 'Parallel', icon: '⚡' },
  { type: 'LoopAgent', label: 'Loop', icon: '🔄' },
];

function AgentNode({ id, data, selected }: AgentNodeProps) {
  const config = agentClassConfig[data.agentClass] || agentClassConfig.LlmAgent;
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle drag start to set node ID in data transfer
  const handleDragStart = useCallback((event: React.DragEvent) => {
    event.dataTransfer.setData('application/reactflow/nodeId', id);
    event.dataTransfer.effectAllowed = 'move';
  }, [id]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // Handle plus button click
  const handlePlusClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setShowDropdown((prev) => !prev);
  }, []);

  // Handle agent type selection
  const handleSelectAgentType = useCallback((agentType: ADKAgentClass) => {
    setShowDropdown(false);
    if (data.onAddChildAgent) {
      data.onAddChildAgent(id, agentType);
    }
  }, [data, id]);

  return (
    <div
      className={`
        relative px-4 py-3 rounded-lg border-2 shadow-sm min-w-[200px] max-w-[280px]
        ${config.bgColor}
        ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
        ${data.isRoot ? 'border-l-4 border-l-blue-500' : ''}
      `}
      data-testid="agent-node"
      draggable
      onDragStart={handleDragStart}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-gray-400 border-2 border-white"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate text-sm">{data.name}</h3>
          <span className={`text-xs font-medium ${config.color}`}>{data.agentClass}</span>
        </div>
        <div className="flex gap-1">
          {data.isRoot && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
              Root
            </span>
          )}
          {data.hasValidationErrors && (
            <span
              data-testid="node-error-badge"
              className="px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded flex items-center gap-0.5"
              title="Has validation errors"
            >
              !
            </span>
          )}
          {data.toolConfigs && Array.from(data.toolConfigs.values()).some(config => config.requireConfirmation) && (
            <span
              data-testid="agent-confirmation-badge"
              className="px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded flex items-center gap-0.5"
              title="Has tools requiring confirmation"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Confirm
            </span>
          )}
        </div>
      </div>

      {/* Model (for LlmAgent) */}
      {data.model && (
        <div className="text-xs text-gray-500 mb-1 truncate">
          Model: <span className="font-mono">{data.model}</span>
        </div>
      )}

      {/* Description */}
      {data.description && (
        <p className="text-xs text-gray-600 line-clamp-2">{data.description}</p>
      )}

      {/* Tools */}
      {(() => {
        const toolsCount = (data.tools?.length || 0) +
                          (data.agentTools?.length || 0) +
                          (data.toolConfigs?.size || 0) +
                          (data.mcpServers?.length || 0) +
                          (data.openApiTools?.length || 0);

        if (toolsCount > 0) {
          return (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="flex flex-wrap gap-1">
                {data.tools?.map((tool, idx) => (
                  <span key={`tool-${idx}`} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded font-mono">
                    {tool}
                  </span>
                ))}
                {data.agentTools?.map((agentTool, idx) => (
                  <span key={`agent-tool-${idx}`} className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-mono flex items-center gap-0.5">
                    🤖 {agentTool.agentName}
                  </span>
                ))}
                {data.toolConfigs && Array.from(data.toolConfigs.keys()).map((toolName) => (
                  <span key={`tool-config-${toolName}`} className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-mono">
                    {toolName}
                  </span>
                ))}
                {data.mcpServers?.map((server, idx) => (
                  <span key={`mcp-${idx}`} className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-mono">
                    MCP: {server.name}
                  </span>
                ))}
                {data.openApiTools?.map((tool, idx) => (
                  <span key={`openapi-${idx}`} className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-mono">
                    {tool.name}
                  </span>
                ))}
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Sub-agents count */}
      {data.subAgents && data.subAgents.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <span className="text-xs text-gray-500">
            {data.subAgents.length} sub-agent{data.subAgents.length > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-gray-400 border-2 border-white"
      />

      {/* Plus button to add child agent */}
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2" ref={dropdownRef}>
        <button
          onClick={handlePlusClick}
          className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition-colors shadow-md"
          data-testid="add-child-button"
          title="Add child agent"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {/* Agent type dropdown */}
        {showDropdown && (
          <div
            className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[140px]"
            data-testid="agent-type-dropdown"
          >
            {agentTypeDropdownItems.map((item) => (
              <button
                key={item.type}
                onClick={() => handleSelectAgentType(item.type)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(AgentNode);
