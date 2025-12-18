'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import AgentNode, { AgentNodeData, ADKAgentClass, ToolConfig } from './AgentNode';
import ContainerNode from './ContainerNode';
import { MCPServerConfig } from './AgentNode';
import { NewAgentToolData, DialogMode } from './AgentToolsPanel';
import { ToolType } from './AddToolsDropdown';
import { BuiltInToolsPanel } from './BuiltInToolsPanel';
import { AddToolsDropdown } from './AddToolsDropdown';
import { getAvailableModels } from '@/lib/pricing';

// Custom node types
const nodeTypes = {
  agent: AgentNode,
  container: ContainerNode,
};

// Helper to determine which node type to use based on agent class
function getNodeType(agentClass: ADKAgentClass): string {
  if (agentClass === 'SequentialAgent' || agentClass === 'ParallelAgent' || agentClass === 'LoopAgent') {
    return 'container';
  }
  return 'agent';
}

// Available models from pricing source of truth
const availableModels = getAvailableModels();

// Agent palette items for drag-and-drop
const agentPaletteItems: { type: ADKAgentClass; label: string; icon: string }[] = [
  { type: 'LlmAgent', label: 'LLM Agent', icon: '🤖' },
  { type: 'SequentialAgent', label: 'Sequential', icon: '⏭️' },
  { type: 'ParallelAgent', label: 'Parallel', icon: '⚡' },
  { type: 'LoopAgent', label: 'Loop', icon: '🔄' },
];

interface AgentComposerProps {
  projectName: string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  availableAgents?: string[];
  onChange?: (nodes: Node[], edges: Edge[]) => void;
  onNodeSelect?: (node: Node | null) => void;
  onNodeDataChange?: (nodeId: string, data: AgentNodeData) => void;
  onNodeCreate?: (data: AgentNodeData) => Promise<{ filename: string } | null>;
  onNodeDelete?: (nodeId: string, filename: string | undefined) => Promise<boolean>;
  onAgentDroppedInContainer?: (containerId: string, containerFilename: string, droppedAgentFilename: string) => Promise<void>;
  onAddChildAgent?: (parentNodeId: string, childAgentClass: ADKAgentClass, parentFilename: string) => Promise<{ filename: string; childNodeData: AgentNodeData } | null>;
  onAddSubAgent?: (containerId: string, containerFilename: string, childAgentClass: ADKAgentClass) => Promise<void>;
  onRemoveFromContainer?: (containerFilename: string, childFilename: string) => Promise<void>;
  onNavigateToAgent?: (agentFilename: string, parentName: string) => void;
  validationResults?: Record<string, { valid: boolean; errors: Array<{ type: string; message: string; field?: string; value?: string }> }>;
  readOnly?: boolean;
}

function AgentComposerInner({
  projectName,
  initialNodes = [],
  initialEdges = [],
  availableAgents = [],
  onChange,
  onNodeSelect,
  onNodeDataChange,
  onNodeCreate,
  onNodeDelete,
  onAgentDroppedInContainer,
  onAddChildAgent,
  onAddSubAgent,
  onRemoveFromContainer,
  onNavigateToAgent,
  validationResults = {},
  readOnly = false,
}: AgentComposerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const reactFlowInstance = useReactFlow();

  // Unified Debug Panel state
  const [mcpServerStates, setMcpServerStates] = useState<
    Record<string, { status: 'connected' | 'disconnected' | 'error' | 'connecting'; tools: Array<{ name: string; description: string; enabled: boolean }>; errorMessage?: string }>
  >({});

  const [expandedToolSections, setExpandedToolSections] = useState<Record<string, Set<ToolType>>>({});

  const onAddChildAgentRef = useRef(onAddChildAgent);
  const onAddSubAgentRef = useRef(onAddSubAgent);
  const onAgentDroppedInContainerRef = useRef(onAgentDroppedInContainer);
  const onRemoveFromContainerRef = useRef(onRemoveFromContainer);

  useEffect(() => {
    onAddChildAgentRef.current = onAddChildAgent;
    onAddSubAgentRef.current = onAddSubAgent;
    onAgentDroppedInContainerRef.current = onAgentDroppedInContainer;
    onRemoveFromContainerRef.current = onRemoveFromContainer;
  }, [onAddChildAgent, onAddSubAgent, onAgentDroppedInContainer, onRemoveFromContainer]);

  const notifyChange = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      onChange?.(newNodes, newEdges);
    },
    [onChange]
  );

  const handleAddChildAgent = useCallback((parentNodeId: string, childAgentClass: ADKAgentClass) => {
    const parentNode = reactFlowInstance.getNode(parentNodeId);
    if (!parentNode) return;
    const parentData = parentNode.data as AgentNodeData;
    if (!parentData.filename) return;
    if (onAddChildAgentRef.current) {
      onAddChildAgentRef.current(parentNodeId, childAgentClass, parentData.filename);
    }
  }, [reactFlowInstance]);

  const handleAddSubAgent = useCallback((containerId: string, childAgentClass: ADKAgentClass) => {
    const containerNode = reactFlowInstance.getNode(containerId);
    if (!containerNode) return;
    const containerData = containerNode.data as AgentNodeData;
    if (!containerData.filename) return;
    if (onAddSubAgentRef.current) {
      onAddSubAgentRef.current(containerId, containerData.filename, childAgentClass);
    }
  }, [reactFlowInstance]);

  const handleAgentDroppedInContainer = useCallback((containerId: string, containerFilename: string, droppedAgentFilename: string) => {
    if (onAgentDroppedInContainerRef.current) {
      onAgentDroppedInContainerRef.current(containerId, containerFilename, droppedAgentFilename);
    }
  }, []);

  const handleRemoveFromContainer = useCallback((containerFilename: string, childFilename: string) => {
    if (onRemoveFromContainerRef.current) {
      onRemoveFromContainerRef.current(containerFilename, childFilename);
    }
  }, []);

  useEffect(() => {
    const nodesWithCallbacks = initialNodes.map(node => {
      const nodeData = node.data as AgentNodeData;
      const filename = nodeData.filename;
      const hasValidationErrors = filename && validationResults[filename] && !validationResults[filename].valid;

      if (node.type === 'container') {
        return {
          ...node,
          data: {
            ...nodeData,
            hasValidationErrors,
            onAgentDroppedInContainer: handleAgentDroppedInContainer,
            onAddSubAgent: handleAddSubAgent,
            onRemoveFromContainer: handleRemoveFromContainer,
          },
        };
      }
      return {
        ...node,
        data: {
          ...nodeData,
          hasValidationErrors,
          onAddChildAgent: handleAddChildAgent,
        },
      };
    });
    setNodes(nodesWithCallbacks);

    if (selectedNode) {
      const updatedSelectedNode = nodesWithCallbacks.find(n => n.id === selectedNode.id);
      if (updatedSelectedNode) {
        setSelectedNode(updatedSelectedNode);
      } else {
        setSelectedNode(null);
        onNodeSelect?.(null);
      }
    }
  }, [initialNodes, validationResults, setNodes, handleAddChildAgent, handleAddSubAgent, handleAgentDroppedInContainer, handleRemoveFromContainer, onNodeSelect, selectedNode]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const getNodeData = (node: Node): AgentNodeData => node.data as AgentNodeData;

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdges = addEdge(
        {
          ...connection,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#6b7280', strokeWidth: 2 },
        },
        edges
      );
      setEdges(newEdges);
      notifyChange(nodes, newEdges);
    },
    [edges, nodes, setEdges, notifyChange]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    onNodeSelect?.(node);
  }, [onNodeSelect]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  const onDragStart = useCallback((event: React.DragEvent, agentType: ADKAgentClass) => {
    event.dataTransfer.setData('application/agentType', agentType);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      const agentType = event.dataTransfer.getData('application/agentType') as ADKAgentClass;
      if (!agentType) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const nodeData: AgentNodeData = {
        name: `New ${agentType.replace('Agent', '')}`,
        agentClass: agentType,
        model: agentType === 'LlmAgent' ? 'gemini-2.0-flash-exp' : undefined,
        description: '',
        isRoot: nodes.length === 0,
      };

      if (onNodeCreate) {
        const result = await onNodeCreate(nodeData);
        if (result) {
          nodeData.filename = result.filename;
        }
      }

      const newNode: Node = {
        id: `agent-${Date.now()}`,
        type: getNodeType(agentType),
        position,
        data: nodeData,
      };

      const newNodes = [...nodes, newNode];
      setNodes(newNodes);
      setSelectedNode(newNode);
      onNodeSelect?.(newNode);
      notifyChange(newNodes, edges);
    },
    [nodes, edges, setNodes, notifyChange, onNodeCreate, onNodeSelect, reactFlowInstance]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const deleteSelectedNode = useCallback(async () => {
    if (!selectedNode) return;
    const nodeData = getNodeData(selectedNode);
    if (onNodeDelete) {
      const success = await onNodeDelete(selectedNode.id, nodeData.filename);
      if (!success) return;
    }
    const newNodes = nodes.filter((n) => n.id !== selectedNode.id);
    const newEdges = edges.filter(
      (e) => e.source !== selectedNode.id && e.target !== selectedNode.id
    );
    setNodes(newNodes);
    setEdges(newEdges);
    setSelectedNode(null);
    onNodeSelect?.(null);
    notifyChange(newNodes, newEdges);
  }, [selectedNode, nodes, edges, setNodes, setEdges, notifyChange, onNodeDelete, onNodeSelect]);

  const updateSelectedNodeDataLocal = useCallback((updates: Partial<AgentNodeData>) => {
    if (!selectedNode) return;
    setNodes((prevNodes) => {
      const currentNode = prevNodes.find(n => n.id === selectedNode.id);
      if (!currentNode) return prevNodes;
      const currentData = currentNode.data as AgentNodeData;
      const newData = { ...currentData, ...updates };
      const newNodes = prevNodes.map((n) =>
        n.id === selectedNode.id ? { ...n, data: newData } : n
      );
      setSelectedNode({ ...selectedNode, data: newData });
      notifyChange(newNodes, edges);
      return newNodes;
    });
  }, [selectedNode, edges, setNodes, notifyChange]);

  const updateSelectedNodeData = useCallback((updates: Partial<AgentNodeData>) => {
    if (!selectedNode) return;
    setNodes((prevNodes) => {
      const currentNode = prevNodes.find(n => n.id === selectedNode.id);
      if (!currentNode) return prevNodes;
      const currentData = currentNode.data as AgentNodeData;
      const newData = { ...currentData, ...updates };
      const newNodes = prevNodes.map((n) =>
        n.id === selectedNode.id ? { ...n, data: newData } : n
      );
      setSelectedNode({ ...selectedNode, data: newData });
      notifyChange(newNodes, edges);
      onNodeDataChange?.(selectedNode.id, newData);
      return newNodes;
    });
  }, [selectedNode, edges, setNodes, notifyChange, onNodeDataChange]);

  const updateToolConfig = useCallback((toolId: string, config: ToolConfig) => {
    if (!selectedNode) return;
    setNodes((prevNodes) => {
      const currentNode = prevNodes.find(n => n.id === selectedNode.id);
      if (!currentNode) return prevNodes;
      const currentData = currentNode.data as AgentNodeData;
      const newConfigs = new Map(currentData.toolConfigs || new Map());
      newConfigs.set(toolId, config);
      const newData = { ...currentData, toolConfigs: newConfigs };
      const newNodes = prevNodes.map((n) =>
        n.id === selectedNode.id ? { ...n, data: newData } : n
      );
      setSelectedNode({ ...selectedNode, data: newData });
      notifyChange(newNodes, edges);
      onNodeDataChange?.(selectedNode.id, newData);
      return newNodes;
    });
  }, [selectedNode, edges, setNodes, notifyChange, onNodeDataChange]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputElement = target.tagName === 'INPUT' ||
                             target.tagName === 'TEXTAREA' ||
                             target.tagName === 'SELECT' ||
                             target.isContentEditable;
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNode && !readOnly && !isInputElement) {
        deleteSelectedNode();
      }
    },
    [selectedNode, readOnly, deleteSelectedNode]
  );

  const minimapNodeColor = useCallback((node: Node) => {
    const data = node.data as AgentNodeData;
    switch (data?.agentClass) {
      case 'LlmAgent': return '#3b82f6';
      case 'SequentialAgent': return '#8b5cf6';
      case 'ParallelAgent': return '#22c55e';
      case 'LoopAgent': return '#f97316';
      default: return '#6b7280';
    }
  }, []);

  return (
    <div className="flex h-full bg-background" onKeyDown={onKeyDown} tabIndex={0} data-testid="agent-composer">
      {/* Agent Palette */}
      {!readOnly && (
        <div className="w-56 bg-card/30 border-r border-border p-4 flex flex-col backdrop-blur-sm" data-testid="agent-palette">
          <h3 className="font-heading font-bold text-foreground mb-3 uppercase text-xs tracking-wider">Components</h3>
          <p className="text-[10px] text-muted-foreground/50 mb-4 font-mono">DRAG TO CANVAS</p>
          <div className="space-y-2">
            {agentPaletteItems.map((item) => (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => onDragStart(e, item.type)}
                data-testid={`palette-${item.type.toLowerCase().replace('agent', '-agent')}`}
                className="flex items-center gap-3 px-3 py-2 bg-accent border border-accent rounded-sm cursor-grab hover:bg-accent/80 hover:border-primary/30 hover:text-primary transition-all duration-200 group"
              >
                <span className="text-lg opacity-80 group-hover:opacity-100">{item.icon}</span>
                <span className="text-xs font-mono text-muted-foreground group-hover:text-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Properties Panel */}
      {!readOnly && selectedNode && (
        <div className="w-80 bg-card/30 border-l border-border p-4 flex flex-col overflow-y-auto backdrop-blur-sm" data-testid="properties-panel">
          <div className="flex items-center justify-between mb-6 border-b border-border pb-2">
            <h3 className="font-heading font-bold text-foreground uppercase text-xs tracking-wider">Configuration</h3>
            <button onClick={onPaneClick} className="p-1 text-muted-foreground/60 hover:text-foreground rounded">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="space-y-6 flex-1">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground/60 mb-1 uppercase tracking-wider">Name</label>
              <input
                type="text"
                value={getNodeData(selectedNode).name}
                onChange={(e) => updateSelectedNodeDataLocal({ name: e.target.value })}
                onBlur={(e) => updateSelectedNodeData({ name: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-background border border-border text-foreground rounded-sm focus:ring-1 focus:ring-primary focus:border-primary transition-colors font-mono"
                placeholder="Agent name"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-muted-foreground/60 mb-1 uppercase tracking-wider">Type</label>
              <select
                value={getNodeData(selectedNode).agentClass}
                onChange={(e) => updateSelectedNodeData({
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
            {getNodeData(selectedNode).agentClass === 'LlmAgent' && (
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground/60 mb-1 uppercase tracking-wider">Model</label>
                <select
                  value={getNodeData(selectedNode).model || 'gemini-2.0-flash-exp'}
                  onChange={(e) => updateSelectedNodeData({ model: e.target.value })}
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
            {getNodeData(selectedNode).agentClass === 'LlmAgent' && (
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground/60 mb-1 uppercase tracking-wider">Description</label>
                <textarea
                  value={getNodeData(selectedNode).description || ''}
                  onChange={(e) => updateSelectedNodeData({ description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-background border border-border text-foreground rounded-sm focus:ring-1 focus:ring-primary focus:border-primary transition-colors resize-none placeholder-muted-foreground/20"
                  placeholder="Brief description of this agent"
                />
              </div>
            )}

            {/* Instruction (for LlmAgent) */}
            {getNodeData(selectedNode).agentClass === 'LlmAgent' && (
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground/60 mb-1 uppercase tracking-wider">Instruction</label>
                <textarea
                  value={getNodeData(selectedNode).instruction || ''}
                  onChange={(e) => updateSelectedNodeData({ instruction: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 text-xs bg-background border border-border text-muted-foreground rounded-sm focus:ring-1 focus:ring-primary focus:border-primary transition-colors resize-none font-mono placeholder-muted-foreground/20 leading-relaxed"
                  placeholder="System instruction for this agent..."
                  data-testid="agent-instruction"
                />
              </div>
            )}

            {/* Tools Section (for LlmAgent) */}
            {getNodeData(selectedNode).agentClass === 'LlmAgent' && (() => {
              const nodeId = selectedNode.id;
              const nodeData = getNodeData(selectedNode);
              const expandedSections = expandedToolSections[nodeId] || new Set<ToolType>();

              // Determine which sections should be visible (has tools OR explicitly expanded)
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

              const handleAddToolType = (type: ToolType) => {
                setExpandedToolSections(prev => {
                  const currentSet = prev[nodeId] || new Set<ToolType>();
                  const newSet = new Set(currentSet);
                  newSet.add(type);
                  return { ...prev, [nodeId]: newSet };
                });
              };

              const handleRemoveSection = (type: ToolType) => {
                setExpandedToolSections(prev => {
                  const currentSet = prev[nodeId] || new Set<ToolType>();
                  const newSet = new Set(currentSet);
                  newSet.delete(type);
                  return { ...prev, [nodeId]: newSet };
                });
              };

              return (
                <div className="space-y-4 pt-4 border-t border-border" data-testid="tools-section">
                  <label className="block text-[10px] font-bold text-muted-foreground/60 mb-2 uppercase tracking-wider">Capabilities</label>
                  
                  {showBuiltin && (
                    <div className="relative bg-accent border border-accent rounded-sm p-2">
                      {!hasBuiltinTools && (
                        <button
                          onClick={() => handleRemoveSection('builtin')}
                          className="absolute -top-2 -right-2 p-1 bg-card border border-border text-muted-foreground hover:text-destructive rounded-full z-10 shadow-sm"
                          title="Remove section"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                      <BuiltInToolsPanel
                        selectedTools={nodeData.tools || []}
                        toolConfigs={nodeData.toolConfigs || new Map()}
                        onToolsChange={(tools) => updateSelectedNodeData({ tools })}
                        onToolConfigChange={updateToolConfig}
                      />
                    </div>
                  )}

                  <AddToolsDropdown
                    onSelectToolType={handleAddToolType}
                    disabledTypes={visibleTypes}
                  />
                </div>
              );
            })()}

            {/* Model Configuration (for LlmAgent) */}
            {getNodeData(selectedNode).agentClass === 'LlmAgent' && (
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
                        {getNodeData(selectedNode).generation_config?.temperature ?? 1.0}
                      </span>
                    </div>
                    <input
                      type="range"
                      id="temperature"
                      min="0"
                      max="2"
                      step="0.1"
                      value={getNodeData(selectedNode).generation_config?.temperature ?? 1.0}
                      onChange={(e) => {
                        const currentConfig = getNodeData(selectedNode).generation_config || {};
                        updateSelectedNodeData({
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
                checked={getNodeData(selectedNode).isRoot || false}
                onChange={(e) => updateSelectedNodeData({ isRoot: e.target.checked })}
                className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary focus:ring-offset-0"
              />
              <label htmlFor="isRoot" className="text-xs text-muted-foreground font-medium">Set as Root Agent</label>
            </div>

            {/* Filename (read-only info) */}
            {getNodeData(selectedNode).filename && (
              <div className="pt-2 border-t border-border mt-2">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-muted-foreground/40 font-mono uppercase">Filename</span>
                    <span className="text-[10px] text-muted-foreground/60 font-mono">{getNodeData(selectedNode).filename}</span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={deleteSelectedNode}
            className="mt-6 w-full px-3 py-2 text-xs font-bold text-destructive bg-destructive/10 border border-destructive/20 rounded-sm hover:bg-destructive/30 hover:border-destructive/40 transition-colors uppercase tracking-wider"
            data-testid="delete-agent-button"
          >
            Delete Agent
          </button>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 h-full" style={{ minHeight: '400px' }} data-testid="agent-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={readOnly ? undefined : onNodesChange}
          onEdgesChange={readOnly ? undefined : onEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onDrop={readOnly ? undefined : onDrop}
          onDragOver={readOnly ? undefined : onDragOver}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="var(--muted-foreground)" className="opacity-20" />
          <Controls className="!bg-card/80 !border-border !fill-foreground/80" />
          <MiniMap nodeColor={minimapNodeColor} maskColor="rgba(10, 25, 49, 0.6)" />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function AgentComposer(props: AgentComposerProps) {
  return (
    <ReactFlowProvider>
      <AgentComposerInner {...props} />
    </ReactFlowProvider>
  );
}