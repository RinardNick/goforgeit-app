'use client';

import { Node } from '@xyflow/react';
import { AgentNodeData, ADKAgentClass, ToolConfig, MCPServerConfig as DefinitionMCPServerConfig } from './AgentNode';
import { BuiltInToolsPanel } from './BuiltInToolsPanel';
import { AddToolsDropdown, ToolType } from './AddToolsDropdown';
import MCPToolsPanel, { MCPServerConfig as RuntimeMCPServerConfig } from './MCPToolsPanel';
import { CustomPythonToolsPanel } from './CustomPythonToolsPanel';
import { ToolRegistryPanel } from './ToolRegistryPanel';
import { getAvailableModels } from '@/lib/pricing';

export interface ValidationError {
  nodeId?: string;
  message: string;
  field?: string;
  value?: string;
  type?: string;
}

export interface MCPServerState {
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  error?: string;
  tools: Array<{ name: string; description: string; enabled: boolean }>;
}

export interface PropertiesPanelProps {
  selectedNode: Node | null;
  files: Array<{ filename: string; yaml: string }>;
  expandedToolSections: Record<string, Set<ToolType>>;
  validationErrors?: ValidationError[];
  mcpServerStates: Record<string, MCPServerState>;
  onClose: () => void;
  onUpdateData: (data: Partial<AgentNodeData>) => void;
  onUpdateToolConfig: (toolName: string, config: ToolConfig) => void;
  onDelete: () => void;
  onExpandToolSection: (nodeId: string, section: ToolType) => void;
  onCollapseToolSection: (nodeId: string, section: ToolType) => void;
  onAddMcpServer: (config: { name: string; type: 'stdio' | 'sse'; command?: string; args?: string[]; env?: Record<string, string>; url?: string }) => void;
  onDeleteMcpServer: (serverId: string) => void;
  onToggleMcpTool: (serverId: string, toolName: string) => void;
  onRefreshMcpServer: (serverId: string) => void;
  onSaveFile?: (filename: string, content: string) => Promise<void>;
}

export function PropertiesPanel({
  selectedNode,
  files,
  expandedToolSections,
  validationErrors = [],
  mcpServerStates,
  onClose,
  onUpdateData,
  onUpdateToolConfig,
  onDelete,
  onExpandToolSection,
  onCollapseToolSection,
  onAddMcpServer,
  onDeleteMcpServer,
  onToggleMcpTool,
  onRefreshMcpServer,
  onSaveFile,
}: PropertiesPanelProps) {
  const nodeId = selectedNode?.id || '';
  const nodeData = (selectedNode?.data as AgentNodeData) || {};
  const isLlmAgent = nodeData.agentClass === 'LlmAgent';

  // Tool section visibility logic
  const expandedSections = expandedToolSections[nodeId] || new Set<ToolType>();
  const hasBuiltinTools = (nodeData.tools || []).length > 0;
  const hasMcpTools = (nodeData.mcpServers || []).length > 0;
  const hasAgentTools = (nodeData.agentTools || []).length > 0;
  const hasOpenApiTools = (nodeData.openApiTools || []).length > 0;
  const hasPythonTools = (nodeData.pythonTools || []).length > 0;
  // We don't have a distinct "hasRegistryTools" check on data yet, relying on user action
  
  const showBuiltin = hasBuiltinTools || expandedSections.has('builtin');
  const showMcp = hasMcpTools || expandedSections.has('mcp');
  const showAgent = hasAgentTools || expandedSections.has('agent');
  const showOpenApi = hasOpenApiTools || expandedSections.has('openapi');
  const showPython = hasPythonTools || expandedSections.has('python');
  const showRegistry = expandedSections.has('registry');

  const visibleTypes: ToolType[] = [];
  if (showBuiltin) visibleTypes.push('builtin');
  if (showMcp) visibleTypes.push('mcp');
  if (showAgent) visibleTypes.push('agent');
  if (showOpenApi) visibleTypes.push('openapi');
  if (showPython) visibleTypes.push('python');
  if (showRegistry) visibleTypes.push('registry');

  // Merge node config with runtime state
  const mergedMcpServers: RuntimeMCPServerConfig[] = (nodeData.mcpServers || []).map(server => {
    const state = mcpServerStates[server.id];
    return {
      ...server,
      status: state?.status || 'disconnected',
      errorMessage: state?.error,
      tools: state?.tools || server.tools || [] 
    };
  });

  const handleImportTool = async (tool: any) => {
    if (tool.type === 'MCP') {
      const config = tool.config;
      onAddMcpServer({
        name: tool.name,
        type: 'sse', // Defaulting to SSE for registry
        url: config.url
      });
    } else if (tool.type === 'CUSTOM') {
      // For Custom tools, we add them to the 'tools' list.
      // Future runtime update will resolve these from shared storage.
      const currentTools = nodeData.tools || [];
      // Use the tool name (or maybe `shared/tool_name` if we want namespace?)
      // Let's use the tool name for now as per spec "tool from Agent A ... execute without manual code copying"
      if (!currentTools.includes(tool.name)) {
        onUpdateData({ tools: [...currentTools, tool.name] });
      }
    }
    // Auto-collapse registry after import? Maybe not, user might want to add more.
  };

  return (
    <div className="w-80 bg-card/30 border-l border-border p-4 flex flex-col overflow-y-auto backdrop-blur-sm" data-testid="properties-panel">
      {/* ... Header and Validation Errors ... */}
      
      {/* ... Name, Type, Model, Description, Instruction ... */}

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

          {/* ... MCP, Agent, OpenAPI, Python Panels ... */}
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

            {showPython && (
              <div className="relative bg-accent border border-accent rounded-sm p-2">
                {!hasPythonTools && (
                  <button
                    onClick={() => onCollapseToolSection(nodeId, 'python')}
                    className="absolute -top-2 -right-2 p-1 bg-card border border-border text-muted-foreground hover:text-destructive rounded-full z-10 shadow-sm"
                    title="Remove section"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <CustomPythonToolsPanel
                  agentFiles={files}
                  onSaveFile={onSaveFile || (async () => {})}
                  onDeleteFile={async (filename) => {
                    if (confirm(`Delete ${filename}?`)) {
                      // We can implement a proper onDeleteFile prop later, 
                      // but for now we can call the API directly or through onUpdateData if it supported files.
                      // Given current structure, we'll wait for final wiring.
                    }
                  }}
                />
              </div>
            )}

          {showRegistry && (
            <div className="relative bg-accent border border-accent rounded-sm p-2">
              <button
                onClick={() => onCollapseToolSection(nodeId, 'registry')}
                className="absolute -top-2 -right-2 p-1 bg-card border border-border text-muted-foreground hover:text-destructive rounded-full z-10 shadow-sm"
                title="Remove section"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <h4 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider">Tool Registry</h4>
              <ToolRegistryPanel onImport={handleImportTool} />
            </div>
          )}

          <AddToolsDropdown
            onSelectToolType={(type) => onExpandToolSection(nodeId, type)}
            disabledTypes={visibleTypes}
          />
        </div>
      )}

      {/* ... Model Config, Root Toggle ... */}

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