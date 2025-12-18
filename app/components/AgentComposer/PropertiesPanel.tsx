'use client';

import { Node } from '@xyflow/react';
import { AgentNodeData, ADKAgentClass, ToolConfig, MCPServerConfig as DefinitionMCPServerConfig } from './AgentNode';
import { BuiltInToolsPanel } from './BuiltInToolsPanel';
import { AddToolsDropdown, ToolType } from './AddToolsDropdown';
import MCPToolsPanel, { MCPServerConfig as RuntimeMCPServerConfig } from './MCPToolsPanel';
import { getAvailableModels } from '@/lib/pricing';

// Available models from pricing source of truth
const availableModels = getAvailableModels();

// Agent palette items for type selection
const agentPaletteItems: { type: ADKAgentClass; label: string; icon: string }[] = [
  { type: 'LlmAgent', label: 'LLM Agent', icon: '🤖' },
  { type: 'SequentialAgent', label: 'Sequential', icon: '⏭️' },
  { type: 'ParallelAgent', label: 'Parallel', icon: '⚡' },
  { type: 'LoopAgent', label: 'Loop', icon: '🔄' },
];

// Validation error type
export interface ValidationError {
  type: string;
  message: string;
  field?: string;
  value?: string;
}

interface PropertiesPanelProps {
  selectedNode: Node;
  expandedToolSections: Record<string, Set<ToolType>>;
  validationErrors?: ValidationError[];
  
  // MCP State
  mcpServerStates: Record<string, { status: any; tools: any[]; errorMessage?: string }>;

  onClose: () => void;
  onUpdateData: (updates: Partial<AgentNodeData>) => void;
  onUpdateDataLocal: (updates: Partial<AgentNodeData>) => void;
  onUpdateToolConfig: (toolId: string, config: ToolConfig) => void;
  onDelete: () => void;
  onExpandToolSection: (nodeId: string, type: ToolType) => void;
  onCollapseToolSection: (nodeId: string, type: ToolType) => void;
  
  // MCP Handlers
  onAddMcpServer: (config: Omit<DefinitionMCPServerConfig, 'id'>) => void;
  onDeleteMcpServer: (id: string) => void;
  onToggleMcpTool: (serverId: string, toolName: string) => void;
  onRefreshMcpServer: (serverId: string) => void;
}

export function PropertiesPanel({
  selectedNode,
  expandedToolSections,
  validationErrors = [],
  mcpServerStates,
  onClose,
  onUpdateData,
  onUpdateDataLocal,
  onUpdateToolConfig,
  onDelete,
  onExpandToolSection,
  onCollapseToolSection,
  onAddMcpServer,
  onDeleteMcpServer,
  onToggleMcpTool,
  onRefreshMcpServer,
}: PropertiesPanelProps) {
  const getNodeData = (): AgentNodeData => selectedNode.data as AgentNodeData;
  const nodeData = getNodeData();
  const nodeId = selectedNode.id;
  const isLlmAgent = nodeData.agentClass === 'LlmAgent';

  // Tool section visibility logic
  const expandedSections = expandedToolSections[nodeId] || new Set<ToolType>();
  const hasBuiltinTools = (nodeData.tools || []).length > 0;
  const hasMcpTools = (nodeData.mcpServers || []).length > 0;
  const hasAgentTools = (nodeData.agentTools || []).length > 0;
  const hasOpenApiTools = (nodeData.openApiTools || []).length > 0;
  const hasPythonTools = (nodeData.pythonTools || []).length > 0;

  const showBuiltin = hasBuiltinTools || expandedSections.has('builtin');
  const showMcp = hasMcpTools || expandedSections.has('mcp');
  const showAgent = hasAgentTools || expandedSections.has('agent');
  const showOpenApi = hasOpenApiTools || expandedSections.has('openapi');
  const showPython = hasPythonTools || expandedSections.has('python');

  const visibleTypes: ToolType[] = [];
  if (showBuiltin) visibleTypes.push('builtin');
  if (showMcp) visibleTypes.push('mcp');
  if (showAgent) visibleTypes.push('agent');
  if (showOpenApi) visibleTypes.push('openapi');
  if (showPython) visibleTypes.push('python');

  // Merge MCP config with runtime state
  const mergedMcpServers: RuntimeMCPServerConfig[] = (nodeData.mcpServers || []).map(server => {
    const runtime = mcpServerStates[server.id] || { status: 'disconnected', tools: [] };
    return {
      ...server,
      status: runtime.status,
      errorMessage: runtime.errorMessage,
      tools: runtime.tools,
    };
  });

  return (
    <div className="w-80 bg-card/30 border-l border-border p-4 flex flex-col overflow-y-auto backdrop-blur-sm" data-testid="properties-panel">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 border-b border-border pb-2">
        <h3 className="font-heading font-bold text-foreground uppercase text-xs tracking-wider">Configuration</h3>
        <button onClick={onClose} className="p-1 text-muted-foreground/60 hover:text-foreground rounded">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-sm" data-testid="validation-errors">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-xs font-bold text-destructive uppercase tracking-wider">Validation Errors</span>
          </div>
          <ul className="space-y-1">
            {validationErrors.map((error, index) => (
              <li key={index} className="text-xs text-destructive/90 font-mono">
                {error.field && <span className="font-bold">{error.field}: </span>}
                {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-6 flex-1">
        {/* Name */}
        <div>
          <label className="block text-[10px] font-bold text-muted-foreground/60 mb-1 uppercase tracking-wider">Name</label>
          <input
            type="text"
            value={nodeData.name}
            onChange={(e) => onUpdateDataLocal({ name: e.target.value })}
            onBlur={(e) => onUpdateData({ name: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-background border border-border text-foreground rounded-sm focus:ring-1 focus:ring-primary focus:border-primary transition-colors font-mono"
            placeholder="Agent name"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-[10px] font-bold text-muted-foreground/60 mb-1 uppercase tracking-wider">Type</label>
          <select
            value={nodeData.agentClass}
            onChange={(e) => onUpdateData({
              agentClass: e.target.value as ADKAgentClass,
              model: e.target.value === 'LlmAgent' ? 'gemini-2.0-flash-exp' : undefined
            })}
            className="w-full px-3 py-2 text-sm bg-background border border-border text-foreground rounded-sm focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
          >
            {agentPaletteItems.map((item) => (
              <option key={item.type} value={item.type}>{item.icon} {item.label}</option>
            ))}
          </select>
        </div>

        {/* Model (for LlmAgent) */}
        {isLlmAgent && (
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground/60 mb-1 uppercase tracking-wider">Model</label>
            <select
              value={nodeData.model || 'gemini-2.0-flash-exp'}
              onChange={(e) => onUpdateData({ model: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-background border border-border text-foreground rounded-sm focus:ring-1 focus:ring-primary focus:border-primary transition-colors font-mono text-xs"
              data-testid="model-select"
            >
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>{model.displayLabel}</option>
              ))}
            </select>
          </div>
        )}

        {/* Description (only for LlmAgent) */}
        {isLlmAgent && (
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground/60 mb-1 uppercase tracking-wider">Description</label>
            <textarea
              value={nodeData.description || ''}
              onChange={(e) => onUpdateData({ description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm bg-background border border-border text-foreground rounded-sm focus:ring-1 focus:ring-primary focus:border-primary transition-colors resize-none placeholder-muted-foreground/20"
              placeholder="Brief description of this agent"
            />
          </div>
        )}

        {/* Instruction (for LlmAgent) */}
        {isLlmAgent && (
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground/60 mb-1 uppercase tracking-wider">Instruction</label>
            <textarea
              value={nodeData.instruction || ''}
              onChange={(e) => onUpdateData({ instruction: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 text-xs bg-background border border-border text-muted-foreground rounded-sm focus:ring-1 focus:ring-primary focus:border-primary transition-colors resize-none font-mono placeholder-muted-foreground/20 leading-relaxed"
              placeholder="System instruction for this agent..."
              data-testid="agent-instruction"
            />
          </div>
        )}

        {/* Tools Section (for LlmAgent) */}
        {isLlmAgent && (
          <div className="space-y-4 pt-4 border-t border-border" data-testid="tools-section">
            <label className="block text-[10px] font-bold text-muted-foreground/60 mb-2 uppercase tracking-wider">Capabilities</label>

            {showBuiltin && (
              <div className="relative bg-accent border border-accent rounded-sm p-2">
                {!hasBuiltinTools && (
                  <button
                    onClick={() => onCollapseToolSection(nodeId, 'builtin')}
                    className="absolute -top-2 -right-2 p-1 bg-card border border-border text-muted-foreground hover:text-destructive rounded-full z-10 shadow-sm"
                    title="Remove section"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <BuiltInToolsPanel
                  selectedTools={nodeData.tools || []}
                  toolConfigs={nodeData.toolConfigs || new Map()}
                  onToolsChange={(tools) => onUpdateData({ tools })}
                  onToolConfigChange={onUpdateToolConfig}
                />
              </div>
            )}

            {showMcp && (
              <div className="relative bg-accent border border-accent rounded-sm p-2">
                {!hasMcpTools && (
                  <button
                    onClick={() => onCollapseToolSection(nodeId, 'mcp')}
                    className="absolute -top-2 -right-2 p-1 bg-card border border-border text-muted-foreground hover:text-destructive rounded-full z-10 shadow-sm"
                    title="Remove section"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <MCPToolsPanel
                  servers={mergedMcpServers}
                  onAddServer={onAddMcpServer}
                  onDeleteServer={onDeleteMcpServer}
                  onToggleTool={(serverId, toolName) => onToggleMcpTool(serverId, toolName)}
                  onRefreshServer={onRefreshMcpServer}
                />
              </div>
            )}

            <AddToolsDropdown
              onSelectToolType={(type) => onExpandToolSection(nodeId, type)}
              disabledTypes={visibleTypes}
            />
          </div>
        )}

        {/* Model Configuration (for LlmAgent) */}
        {isLlmAgent && (
          <div data-testid="model-config-section" className="pt-4 border-t border-border">
            <label className="block text-[10px] font-bold text-muted-foreground/60 mb-2 uppercase tracking-wider">Parameters</label>
            <div className="space-y-3 bg-accent border border-accent rounded-sm p-3">
              {/* Temperature Slider */}
              <div data-testid="temperature-slider">
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="temperature" className="text-xs font-medium text-muted-foreground">
                    Temperature
                  </label>
                  <span className="text-xs font-mono text-primary">
                    {nodeData.generation_config?.temperature ?? 1.0}
                  </span>
                </div>
                <input
                  type="range"
                  id="temperature"
                  min="0"
                  max="2"
                  step="0.1"
                  value={nodeData.generation_config?.temperature ?? 1.0}
                  onChange={(e) => {
                    const currentConfig = nodeData.generation_config || {};
                    onUpdateData({
                      generation_config: { ...currentConfig, temperature: parseFloat(e.target.value) }
                    });
                  }}
                  className="w-full h-1 bg-card rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* Root Agent Toggle */}
        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="isRoot"
            checked={nodeData.isRoot || false}
            onChange={(e) => onUpdateData({ isRoot: e.target.checked })}
            className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary focus:ring-offset-0"
          />
          <label htmlFor="isRoot" className="text-xs text-muted-foreground font-medium">Set as Root Agent</label>
        </div>

        {/* Filename (read-only info) */}
        {nodeData.filename && (
          <div className="pt-2 border-t border-border mt-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground/40 font-mono uppercase">Filename</span>
              <span className="text-[10px] text-muted-foreground/60 font-mono">{nodeData.filename}</span>
            </div>
          </div>
        )}
      </div>

      {/* Delete Button */}
      <button
        onClick={onDelete}
        className="mt-6 w-full px-3 py-2 text-xs font-bold text-destructive bg-destructive/10 border border-destructive/20 rounded-sm hover:bg-destructive/30 hover:border-destructive/40 transition-colors uppercase tracking-wider"
        data-testid="delete-agent-button"
      >
        Delete Agent
      </button>
    </div>
  );
}