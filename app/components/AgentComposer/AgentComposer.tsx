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

import AgentNode, { AgentNodeData, ADKAgentClass, GenerationConfig, MCPServerConfig, AgentToolConfig, OpenAPIToolConfig, CallbackConfig, CallbackType, PythonToolConfig, ToolConfig } from './AgentNode';
import ContainerNode from './ContainerNode';
import MCPToolsPanel, { MCPServerConfig as MCPServerConfigFull } from './MCPToolsPanel';
import AgentToolsPanel, { NewAgentToolData, DialogMode } from './AgentToolsPanel';
import { OpenAPIToolsPanel } from './OpenAPIToolsPanel';
import { CallbacksPanel } from './CallbacksPanel';
import { BuiltInToolsPanel } from './BuiltInToolsPanel';
import { AddToolsDropdown, ToolType } from './AddToolsDropdown';
import CustomPythonToolsPanel from './CustomPythonToolsPanel';

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

// Available models for LLM agents
const availableModels = [
  'gemini-2.0-flash-exp',
  'gemini-2.5-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
];

// Agent palette items for drag-and-drop
const agentPaletteItems: { type: ADKAgentClass; label: string; icon: string }[] = [
  { type: 'LlmAgent', label: 'LLM Agent', icon: '🤖' },
  { type: 'SequentialAgent', label: 'Sequential', icon: '⏭️' },
  { type: 'ParallelAgent', label: 'Parallel', icon: '⚡' },
  { type: 'LoopAgent', label: 'Loop', icon: '🔄' },
];

interface AgentComposerProps {
  projectName: string; // Name of the ADK agent project
  initialNodes?: Node[];
  initialEdges?: Edge[];
  availableAgents?: string[]; // List of all agent filenames in the project (for AgentTool selector)
  onChange?: (nodes: Node[], edges: Edge[]) => void;
  onNodeSelect?: (node: Node | null) => void;
  onNodeDataChange?: (nodeId: string, data: AgentNodeData) => void;
  onNodeCreate?: (data: AgentNodeData) => Promise<{ filename: string } | null>;
  onNodeDelete?: (nodeId: string, filename: string | undefined) => Promise<boolean>;
  onAgentDroppedInContainer?: (containerId: string, containerFilename: string, droppedAgentFilename: string) => Promise<void>;
  onAddChildAgent?: (parentNodeId: string, childAgentClass: ADKAgentClass, parentFilename: string) => Promise<{ filename: string; childNodeData: AgentNodeData } | null>;
  onAddSubAgent?: (containerId: string, containerFilename: string, childAgentClass: ADKAgentClass) => Promise<void>;
  onRemoveFromContainer?: (containerFilename: string, childFilename: string) => Promise<void>;
  onNavigateToAgent?: (agentFilename: string, parentName: string) => void; // Navigate to agent tool editor
  validationResults?: Record<string, { valid: boolean; errors: Array<{ type: string; message: string; field?: string; value?: string }> }>;
  readOnly?: boolean;
}

// Inner component that has access to ReactFlow instance
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
  const [showAddTool, setShowAddTool] = useState(false);
  const [newToolName, setNewToolName] = useState('');
  const reactFlowInstance = useReactFlow();

  // State for AgentToolsPanel dialog mode
  const [agentToolsDialogMode, setAgentToolsDialogMode] = useState<DialogMode>('closed');

  // MCP server runtime state - maps server ID to {status, tools, errorMessage}
  const [mcpServerStates, setMcpServerStates] = useState<
    Record<string, { status: 'connected' | 'disconnected' | 'error' | 'connecting'; tools: Array<{ name: string; description: string; enabled: boolean }>; errorMessage?: string }>
  >({});

  // Track which tool sections the user has explicitly expanded (for each node)
  const [expandedToolSections, setExpandedToolSections] = useState<Record<string, Set<ToolType>>>({});

  // Validate an MCP server by calling the API
  const validateMcpServer = useCallback(async (serverId: string, serverConfig: MCPServerConfig) => {
    // Set status to connecting
    setMcpServerStates(prev => ({
      ...prev,
      [serverId]: { status: 'connecting', tools: prev[serverId]?.tools || [], errorMessage: undefined },
    }));

    try {
      const response = await fetch('/api/mcp/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: serverConfig.type,
          command: serverConfig.command,
          args: serverConfig.args,
          env: serverConfig.env,
          url: serverConfig.url,
          headers: serverConfig.headers,
        }),
      });

      const data = await response.json();

      // Map status from API response
      const status: 'connected' | 'error' = data.status === 'connected' ? 'connected' : 'error';
      const tools = (data.tools || []).map((t: { name: string; description: string }) => ({
        name: t.name,
        description: t.description,
        enabled: true, // Default all tools to enabled
      }));

      setMcpServerStates(prev => ({
        ...prev,
        [serverId]: { status, tools, errorMessage: data.errorMessage },
      }));
    } catch (error) {
      setMcpServerStates(prev => ({
        ...prev,
        [serverId]: {
          status: 'error',
          tools: prev[serverId]?.tools || [],
          errorMessage: error instanceof Error ? error.message : 'Failed to validate server'
        },
      }));
    }
  }, []);

  // Handle toggling a tool on/off
  const handleToggleTool = useCallback((serverId: string, toolName: string) => {
    setMcpServerStates(prev => {
      const serverState = prev[serverId];
      if (!serverState) return prev;

      return {
        ...prev,
        [serverId]: {
          ...serverState,
          tools: serverState.tools.map(t =>
            t.name === toolName ? { ...t, enabled: !t.enabled } : t
          ),
        },
      };
    });
  }, []);

  // Store callbacks in refs to avoid infinite loops in useEffect
  const onAddChildAgentRef = useRef(onAddChildAgent);
  const onAddSubAgentRef = useRef(onAddSubAgent);
  const onAgentDroppedInContainerRef = useRef(onAgentDroppedInContainer);
  const onRemoveFromContainerRef = useRef(onRemoveFromContainer);

  // Keep refs up to date
  useEffect(() => {
    onAddChildAgentRef.current = onAddChildAgent;
    onAddSubAgentRef.current = onAddSubAgent;
    onAgentDroppedInContainerRef.current = onAgentDroppedInContainer;
    onRemoveFromContainerRef.current = onRemoveFromContainer;
  }, [onAddChildAgent, onAddSubAgent, onAgentDroppedInContainer, onRemoveFromContainer]);

  // Notify parent of changes
  const notifyChange = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      onChange?.(newNodes, newEdges);
    },
    [onChange]
  );

  // Create stable wrapper functions that access refs
  const handleAddChildAgent = useCallback((parentNodeId: string, childAgentClass: ADKAgentClass) => {
    // Find the parent node to get its filename
    const parentNode = reactFlowInstance.getNode(parentNodeId);
    if (!parentNode) return;

    const parentData = parentNode.data as AgentNodeData;
    if (!parentData.filename) {
      console.error('Parent node has no filename');
      return;
    }

    // Call the prop callback with the filename
    if (onAddChildAgentRef.current) {
      onAddChildAgentRef.current(parentNodeId, childAgentClass, parentData.filename);
    }
  }, [reactFlowInstance]);

  const handleAddSubAgent = useCallback((containerId: string, childAgentClass: ADKAgentClass) => {
    // Find the container node to get its filename
    const containerNode = reactFlowInstance.getNode(containerId);
    if (!containerNode) return;

    const containerData = containerNode.data as AgentNodeData;
    if (!containerData.filename) {
      console.error('Container node has no filename');
      return;
    }

    // Call the prop callback with the filename
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

  // Sync nodes when initialNodes or validationResults change (from parent)
  // Include callbacks and validation directly in the node data
  useEffect(() => {
    const nodesWithCallbacks = initialNodes.map(node => {
      const nodeData = node.data as AgentNodeData;

      // Check for validation errors
      const filename = nodeData.filename;
      const hasValidationErrors =
        filename && validationResults[filename] && !validationResults[filename].valid;

      // Inject callbacks based on node type
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
      // For regular agent nodes
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

    // If selectedNode exists, update it with fresh data from new nodes
    // This handles the case where we switch context (Main Agent -> Tool Agent)
    // and the selected node ID (e.g., "root") stays the same but data changes
    if (selectedNode) {
      const updatedSelectedNode = nodesWithCallbacks.find(n => n.id === selectedNode.id);
      if (updatedSelectedNode) {
        setSelectedNode(updatedSelectedNode);
      } else {
        // Node no longer exists, deselect
        setSelectedNode(null);
        onNodeSelect?.(null);
      }
    }
  }, [initialNodes, validationResults, setNodes, handleAddChildAgent, handleAddSubAgent, handleAgentDroppedInContainer, handleRemoveFromContainer]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Helper to get typed data from a node
  const getNodeData = (node: Node): AgentNodeData => node.data as AgentNodeData;

  // Handle new connections
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

  // Handle node selection
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    onNodeSelect?.(node);
  }, [onNodeSelect]);

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  // Handle drag from palette
  const onDragStart = useCallback((event: React.DragEvent, agentType: ADKAgentClass) => {
    event.dataTransfer.setData('application/agentType', agentType);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  // Handle drop on canvas
  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();

      const agentType = event.dataTransfer.getData('application/agentType') as ADKAgentClass;
      if (!agentType) return;

      console.log('[onDrop] Dropping agent type:', agentType);

      // Get canvas position using ReactFlow's coordinate transformation
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Create initial node data
      const nodeData: AgentNodeData = {
        name: `New ${agentType.replace('Agent', '')}`,
        agentClass: agentType,
        model: agentType === 'LlmAgent' ? 'gemini-2.0-flash-exp' : undefined,
        description: '',
        isRoot: nodes.length === 0,
      };

      console.log('[onDrop] Initial nodeData:', nodeData);
      console.log('[onDrop] onNodeCreate callback exists:', !!onNodeCreate);

      // If onNodeCreate callback exists, create the YAML file first
      if (onNodeCreate) {
        console.log('[onDrop] Calling onNodeCreate...');
        const result = await onNodeCreate(nodeData);
        console.log('[onDrop] onNodeCreate result:', result);
        if (result) {
          nodeData.filename = result.filename;
        }
      }

      console.log('[onDrop] Final nodeData with filename:', nodeData);

      // Create new node
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

  // Delete selected node
  const deleteSelectedNode = useCallback(async () => {
    if (!selectedNode) return;

    const nodeData = getNodeData(selectedNode);

    // If onNodeDelete callback exists, delete the YAML file first
    if (onNodeDelete) {
      const success = await onNodeDelete(selectedNode.id, nodeData.filename);
      if (!success) {
        return; // Don't delete the node if file deletion failed
      }
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

  // Update selected node data locally (visual only, no file operations)
  // Uses functional update to avoid stale closure issues with rapid updates
  const updateSelectedNodeDataLocal = useCallback((updates: Partial<AgentNodeData>) => {
    if (!selectedNode) return;

    // Use setNodes functional update to get current node data
    setNodes((prevNodes) => {
      const currentNode = prevNodes.find(n => n.id === selectedNode.id);
      if (!currentNode) return prevNodes;

      const currentData = currentNode.data as AgentNodeData;
      const newData = { ...currentData, ...updates };
      const newNodes = prevNodes.map((n) =>
        n.id === selectedNode.id ? { ...n, data: newData } : n
      );

      // Update selectedNode with fresh data
      setSelectedNode({ ...selectedNode, data: newData });

      // Notify parent with fresh nodes
      notifyChange(newNodes, edges);

      return newNodes;
    });
  }, [selectedNode, edges, setNodes, notifyChange]);

  // Update selected node data and trigger file operations (for blur events)
  // Uses functional update to avoid stale closure issues with rapid updates
  const updateSelectedNodeData = useCallback((updates: Partial<AgentNodeData>) => {
    if (!selectedNode) return;

    // Use setNodes functional update to get current node data
    setNodes((prevNodes) => {
      const currentNode = prevNodes.find(n => n.id === selectedNode.id);
      if (!currentNode) return prevNodes;

      const currentData = currentNode.data as AgentNodeData;
      const newData = { ...currentData, ...updates };
      const newNodes = prevNodes.map((n) =>
        n.id === selectedNode.id ? { ...n, data: newData } : n
      );

      // Update selectedNode with fresh data
      setSelectedNode({ ...selectedNode, data: newData });

      // Notify parent with fresh nodes and edges
      // We need to get fresh edges too, so use a ref or rely on notifyChange
      notifyChange(newNodes, edges);

      // Trigger file operations with new data
      onNodeDataChange?.(selectedNode.id, newData);

      return newNodes;
    });
  }, [selectedNode, edges, setNodes, notifyChange, onNodeDataChange]);

  // Specialized function for updating tool configs with proper merge
  // This avoids stale closure issues when multiple tool configs are updated rapidly
  const updateToolConfig = useCallback((toolId: string, config: ToolConfig) => {
    if (!selectedNode) return;

    setNodes((prevNodes) => {
      const currentNode = prevNodes.find(n => n.id === selectedNode.id);
      if (!currentNode) return prevNodes;

      const currentData = currentNode.data as AgentNodeData;
      // Get fresh toolConfigs from current state and merge
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

  // Handle keyboard shortcuts
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // Don't trigger delete when focus is on an input element
      const target = event.target as HTMLElement;
      const isInputElement = target.tagName === 'INPUT' ||
                             target.tagName === 'TEXTAREA' ||
                             target.tagName === 'SELECT' ||
                             target.isContentEditable;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedNode && !readOnly && !isInputElement) {
          deleteSelectedNode();
        }
      }
    },
    [selectedNode, readOnly, deleteSelectedNode]
  );

  // Minimap node color
  const minimapNodeColor = useCallback((node: Node) => {
    const data = node.data as AgentNodeData;
    switch (data?.agentClass) {
      case 'LlmAgent':
        return '#3b82f6';
      case 'SequentialAgent':
        return '#8b5cf6';
      case 'ParallelAgent':
        return '#22c55e';
      case 'LoopAgent':
        return '#f97316';
      default:
        return '#6b7280';
    }
  }, []);

  return (
    <div className="flex h-full" onKeyDown={onKeyDown} tabIndex={0} data-testid="agent-composer">
      {/* Agent Palette */}
      {!readOnly && (
        <div className="w-56 bg-white border-r border-gray-200 p-4 flex flex-col" data-testid="agent-palette">
          <h3 className="font-semibold text-gray-900 mb-3">Agent Palette</h3>
          <p className="text-xs text-gray-500 mb-4">Drag agents onto the canvas</p>
          <div className="space-y-2">
            {agentPaletteItems.map((item) => (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => onDragStart(e, item.type)}
                data-testid={`palette-${item.type.toLowerCase().replace('agent', '-agent')}`}
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg cursor-grab hover:bg-gray-100 hover:border-gray-300 transition-colors"
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* Properties Panel - Right Side */}
      {!readOnly && selectedNode && (
        <div className="w-72 bg-white border-l border-gray-200 p-4 flex flex-col overflow-y-auto" data-testid="properties-panel">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Properties</h3>
            <button
              onClick={onPaneClick}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Validation Errors */}
          {selectedNode && getNodeData(selectedNode).filename && validationResults[getNodeData(selectedNode).filename!] && !validationResults[getNodeData(selectedNode).filename!].valid && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg" data-testid="validation-error">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-red-800 mb-1">Validation Errors</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {validationResults[getNodeData(selectedNode).filename!].errors.map((error, idx) => (
                      <li key={idx}>
                        {error.value && <span className="font-mono text-xs bg-red-100 px-1 rounded">{error.value}</span>} {error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 flex-1">
            {/* Agent Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={getNodeData(selectedNode).name}
                onChange={(e) => updateSelectedNodeDataLocal({ name: e.target.value })}
                onBlur={(e) => updateSelectedNodeData({ name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Agent name"
              />
            </div>

            {/* Agent Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={getNodeData(selectedNode).agentClass}
                onChange={(e) => updateSelectedNodeData({
                  agentClass: e.target.value as ADKAgentClass,
                  model: e.target.value === 'LlmAgent' ? 'gemini-2.0-flash-exp' : undefined
                })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {agentPaletteItems.map((item) => (
                  <option key={item.type} value={item.type}>
                    {item.icon} {item.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Model (for LlmAgent) */}
            {getNodeData(selectedNode).agentClass === 'LlmAgent' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <select
                  value={getNodeData(selectedNode).model || 'gemini-2.0-flash-exp'}
                  onChange={(e) => updateSelectedNodeData({ model: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  data-testid="model-select"
                >
                  {availableModels.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Description (only for LlmAgent) */}
            {getNodeData(selectedNode).agentClass === 'LlmAgent' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={getNodeData(selectedNode).description || ''}
                  onChange={(e) => updateSelectedNodeData({ description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Brief description of this agent"
                />
              </div>
            )}

            {/* Instruction (for LlmAgent) */}
            {getNodeData(selectedNode).agentClass === 'LlmAgent' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instruction</label>
                <textarea
                  value={getNodeData(selectedNode).instruction || ''}
                  onChange={(e) => updateSelectedNodeData({ instruction: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-xs"
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

              // Calculate which types are already visible (for the dropdown to hide)
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
                <div className="space-y-3" data-testid="tools-section">
                  {/* Built-in Tools */}
                  {showBuiltin && (
                    <div className="relative">
                      {!hasBuiltinTools && (
                        <button
                          onClick={() => handleRemoveSection('builtin')}
                          className="absolute -top-1 -right-1 p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors z-10"
                          title="Remove section"
                          data-testid="remove-builtin-section"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
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

                  {/* MCP Tools */}
                  {showMcp && (
                    <div className="relative group">
                      {!hasMcpTools && (
                        <button
                          onClick={() => handleRemoveSection('mcp')}
                          className="absolute top-0 right-8 p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove section"
                          data-testid="remove-mcp-section"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      <MCPToolsPanel
                        servers={(nodeData.mcpServers || []).map(server => {
                          const runtimeState = mcpServerStates[server.id];
                          return {
                            ...server,
                            status: runtimeState?.status || 'disconnected',
                            tools: runtimeState?.tools || [],
                            errorMessage: runtimeState?.errorMessage,
                          };
                        })}
                        onAddServer={(config) => {
                          const currentMcpServers = nodeData.mcpServers || [];
                          const newServer: MCPServerConfig = {
                            id: `mcp-${Date.now()}`,
                            name: config.name,
                            type: config.type,
                            command: config.command,
                            args: config.args,
                            env: config.env,
                            url: config.url,
                            headers: config.headers,
                          };
                          updateSelectedNodeData({ mcpServers: [...currentMcpServers, newServer] });
                        }}
                        onDeleteServer={(id) => {
                          const currentMcpServers = nodeData.mcpServers || [];
                          updateSelectedNodeData({ mcpServers: currentMcpServers.filter(s => s.id !== id) });
                          setMcpServerStates(prev => {
                            const newState = { ...prev };
                            delete newState[id];
                            return newState;
                          });
                        }}
                        onToggleTool={(serverId, toolName) => {
                          handleToggleTool(serverId, toolName);
                        }}
                        onRefreshServer={(serverId) => {
                          const serverConfig = (nodeData.mcpServers || []).find(s => s.id === serverId);
                          if (serverConfig) {
                            validateMcpServer(serverId, serverConfig);
                          }
                        }}
                      />
                    </div>
                  )}

                  {/* Agent Tools */}
                  {showAgent && (
                    <div className="relative">
                      {!hasAgentTools && (
                        <button
                          onClick={() => handleRemoveSection('agent')}
                          className="absolute -top-1 -right-1 p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors z-10"
                          title="Remove section"
                          data-testid="remove-agent-section"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      <AgentToolsPanel
                        agentTools={nodeData.agentTools || []}
                        availableAgents={availableAgents}
                        currentAgentFilename={nodeData.filename}
                        onAddAgentTool={(agentPath) => {
                          const currentAgentTools = nodeData.agentTools || [];
                          const agentName = agentPath.replace('.yaml', '');
                          const newAgentTool: AgentToolConfig = {
                            id: `agent-tool-${Date.now()}`,
                            agentPath,
                            agentName,
                          };
                          updateSelectedNodeData({ agentTools: [...currentAgentTools, newAgentTool] });
                        }}
                        onCreateNewAgentTool={async (data) => {
                          // Create a new agent via the onNodeCreate callback
                          if (!onNodeCreate) {
                            throw new Error('Cannot create new agent - onNodeCreate not available');
                          }

                          const newAgentData: AgentNodeData = {
                            name: data.name,
                            label: data.name,
                            agentClass: 'LlmAgent',
                            model: data.model,
                            description: data.description,
                            instruction: data.instruction,
                            tools: [],
                            mcpServers: [],
                            agentTools: [],
                            openApiTools: [],
                            callbacks: [],
                            pythonTools: [],
                          };

                          const result = await onNodeCreate(newAgentData);
                          if (!result) {
                            throw new Error('Failed to create new agent');
                          }

                          return result.filename;
                        }}
                        onDeleteAgentTool={(id) => {
                          const currentAgentTools = nodeData.agentTools || [];
                          updateSelectedNodeData({ agentTools: currentAgentTools.filter(t => t.id !== id) });
                        }}
                        onNavigateToAgent={(agentFilename) => {
                          // Call parent's onNavigateToAgent to enter tool agent mode
                          if (onNavigateToAgent) {
                            onNavigateToAgent(agentFilename, nodeData.name);
                          }
                        }}
                        dialogMode={agentToolsDialogMode}
                        setDialogMode={setAgentToolsDialogMode}
                      />
                    </div>
                  )}

                  {/* OpenAPI Tools */}
                  {showOpenApi && (
                    <div className="relative">
                      {!hasOpenApiTools && (
                        <button
                          onClick={() => handleRemoveSection('openapi')}
                          className="absolute -top-1 -right-1 p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors z-10"
                          title="Remove section"
                          data-testid="remove-openapi-section"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      <OpenAPIToolsPanel
                        openApiTools={nodeData.openApiTools || []}
                        onAddOpenApiTool={(name, specUrl) => {
                          const currentOpenApiTools = nodeData.openApiTools || [];
                          const newOpenApiTool: OpenAPIToolConfig = {
                            id: `openapi-tool-${Date.now()}`,
                            name,
                            specUrl,
                          };
                          updateSelectedNodeData({ openApiTools: [...currentOpenApiTools, newOpenApiTool] });
                        }}
                        onDeleteOpenApiTool={(id) => {
                          const currentOpenApiTools = nodeData.openApiTools || [];
                          updateSelectedNodeData({ openApiTools: currentOpenApiTools.filter(t => t.id !== id) });
                        }}
                      />
                    </div>
                  )}

                  {/* Custom Python Tools */}
                  {showPython && (
                    <div className="relative" data-testid="custom-python-tools-section">
                      {!hasPythonTools && (
                        <button
                          onClick={() => handleRemoveSection('python')}
                          className="absolute -top-1 -right-1 p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors z-10"
                          title="Remove section"
                          data-testid="remove-python-section"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      <CustomPythonToolsPanel
                        projectName={projectName}
                        pythonTools={nodeData.pythonTools || []}
                        onToolsChange={(tools) => updateSelectedNodeData({ pythonTools: tools })}
                        onCreateTool={async (name, code) => {
                          // Create the tool via API
                          try {
                            const response = await fetch(`/api/adk-agents/${projectName}/tools/python`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ name, code }),
                            });
                            if (!response.ok) {
                              console.error('Failed to create Python tool');
                              return null;
                            }
                            const result = await response.json();
                            // API returns { success: true, tool: {...} }
                            if (result.success && result.tool) {
                              // Add an id field for React key/tracking
                              return { ...result.tool, id: result.tool.filename };
                            }
                            return null;
                          } catch (error) {
                            console.error('Error creating Python tool:', error);
                            return null;
                          }
                        }}
                        onDeleteTool={async (id) => {
                          // Delete the tool via API
                          const tool = (nodeData.pythonTools || []).find(t => t.id === id);
                          if (!tool) return false;
                          try {
                            const response = await fetch(`/api/adk-agents/${projectName}/tools/python?filename=${encodeURIComponent(tool.filename)}`, {
                              method: 'DELETE',
                            });
                            return response.ok;
                          } catch (error) {
                            console.error('Error deleting Python tool:', error);
                            return false;
                          }
                        }}
                        onTestTool={async (toolName, params) => {
                          // Test the tool via ADK API
                          // toolName comes from the panel - find the corresponding filename
                          const tool = (nodeData.pythonTools || []).find(t => t.name === toolName);
                          const filename = tool?.filename || `${toolName}.py`;
                          try {
                            const response = await fetch(`/api/adk-agents/${projectName}/tools/python/test`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ filename, params }),
                            });
                            if (!response.ok) {
                              const error = await response.json();
                              return { success: false, error: error.error || 'Test failed' };
                            }
                            const result = await response.json();
                            return result;
                          } catch (error) {
                            return { success: false, error: String(error) };
                          }
                        }}
                      />
                    </div>
                  )}

                  {/* Add Tools Dropdown */}
                  <AddToolsDropdown
                    onSelectToolType={handleAddToolType}
                    disabledTypes={visibleTypes}
                  />
                </div>
              );
            })()}

            {/* Model Configuration (for LlmAgent) */}
            {getNodeData(selectedNode).agentClass === 'LlmAgent' && (
              <div data-testid="model-config-section">
                <label className="block text-sm font-medium text-gray-700 mb-2">Model Configuration</label>
                <div className="space-y-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  {/* Temperature Slider */}
                  <div data-testid="temperature-slider">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="temperature" className="text-xs font-medium text-gray-600">
                        Temperature
                      </label>
                      <span className="text-xs font-mono text-gray-500">
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
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  {/* Max Output Tokens */}
                  <div data-testid="max-tokens-input">
                    <label htmlFor="max_tokens" className="text-xs font-medium text-gray-600 block mb-1">
                      Max Output Tokens
                    </label>
                    <input
                      type="number"
                      id="max_tokens"
                      min="1"
                      value={getNodeData(selectedNode).generation_config?.max_output_tokens ?? ''}
                      onChange={(e) => {
                        const currentConfig = getNodeData(selectedNode).generation_config || {};
                        const value = e.target.value ? parseInt(e.target.value) : undefined;
                        updateSelectedNodeData({
                          generation_config: { ...currentConfig, max_output_tokens: value }
                        });
                      }}
                      placeholder="Default"
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Top-P Slider */}
                  <div data-testid="top-p-slider">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="top_p" className="text-xs font-medium text-gray-600">
                        Top-P
                      </label>
                      <span className="text-xs font-mono text-gray-500">
                        {getNodeData(selectedNode).generation_config?.top_p ?? 0.95}
                      </span>
                    </div>
                    <input
                      type="range"
                      id="top_p"
                      min="0"
                      max="1"
                      step="0.05"
                      value={getNodeData(selectedNode).generation_config?.top_p ?? 0.95}
                      onChange={(e) => {
                        const currentConfig = getNodeData(selectedNode).generation_config || {};
                        updateSelectedNodeData({
                          generation_config: { ...currentConfig, top_p: parseFloat(e.target.value) }
                        });
                      }}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  {/* Top-K Input */}
                  <div data-testid="top-k-input">
                    <label htmlFor="top_k" className="text-xs font-medium text-gray-600 block mb-1">
                      Top-K
                    </label>
                    <input
                      type="number"
                      id="top_k"
                      min="1"
                      value={getNodeData(selectedNode).generation_config?.top_k ?? ''}
                      onChange={(e) => {
                        const currentConfig = getNodeData(selectedNode).generation_config || {};
                        const value = e.target.value ? parseInt(e.target.value) : undefined;
                        updateSelectedNodeData({
                          generation_config: { ...currentConfig, top_k: value }
                        });
                      }}
                      placeholder="Default"
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Callbacks (for LlmAgent) */}
            {getNodeData(selectedNode).agentClass === 'LlmAgent' && (
              <CallbacksPanel
                callbacks={getNodeData(selectedNode).callbacks || []}
                onAddCallback={(type: CallbackType, functionPath: string) => {
                  const currentCallbacks = getNodeData(selectedNode).callbacks || [];
                  const newCallback: CallbackConfig = {
                    id: `callback-${Date.now()}`,
                    type,
                    functionPath,
                  };
                  updateSelectedNodeData({ callbacks: [...currentCallbacks, newCallback] });
                }}
                onDeleteCallback={(id: string) => {
                  const currentCallbacks = getNodeData(selectedNode).callbacks || [];
                  updateSelectedNodeData({ callbacks: currentCallbacks.filter(c => c.id !== id) });
                }}
              />
            )}

            {/* Custom Tools (for LlmAgent) */}
            {getNodeData(selectedNode).agentClass === 'LlmAgent' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Tools</label>
                <div className="space-y-2">
                  {/* Existing custom tools list (filtered to exclude built-in tools) */}
                  {(getNodeData(selectedNode).tools || [])
                    .filter(tool => ![
                      'google_search', 'EnterpriseWebSearchTool', 'VertexAiSearchTool',
                      'built_in_code_execution', 'FilesRetrieval', 'load_memory', 'preload_memory',
                      'url_context', 'VertexAiRagRetrieval', 'exit_loop', 'get_user_choice',
                      'load_artifacts', 'LongRunningFunctionTool'
                    ].includes(tool))
                    .map((tool) => (
                    <div
                      key={tool}
                      className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                      data-testid="tool-item"
                    >
                      <span className="text-sm font-mono text-gray-700">{tool}</span>
                      <button
                        onClick={() => {
                          const currentTools = getNodeData(selectedNode).tools || [];
                          const newTools = currentTools.filter(t => t !== tool);
                          updateSelectedNodeData({ tools: newTools });
                        }}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        data-testid="remove-tool-button"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}

                  {/* Add tool UI */}
                  {showAddTool ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newToolName}
                        onChange={(e) => setNewToolName(e.target.value)}
                        placeholder="tool_name"
                        className="flex-1 px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        data-testid="tool-name-input"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newToolName.trim()) {
                            const currentTools = getNodeData(selectedNode).tools || [];
                            updateSelectedNodeData({ tools: [...currentTools, newToolName.trim()] });
                            setNewToolName('');
                            setShowAddTool(false);
                          } else if (e.key === 'Escape') {
                            setNewToolName('');
                            setShowAddTool(false);
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (newToolName.trim()) {
                            const currentTools = getNodeData(selectedNode).tools || [];
                            updateSelectedNodeData({ tools: [...currentTools, newToolName.trim()] });
                            setNewToolName('');
                            setShowAddTool(false);
                          }
                        }}
                        className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                        data-testid="confirm-tool-button"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          setNewToolName('');
                          setShowAddTool(false);
                        }}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddTool(true)}
                      className="w-full px-3 py-2 text-sm text-gray-600 bg-gray-50 border border-dashed border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-colors flex items-center justify-center gap-2"
                      data-testid="add-tool-button"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Tool
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Root Agent Toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isRoot"
                checked={getNodeData(selectedNode).isRoot || false}
                onChange={(e) => updateSelectedNodeData({ isRoot: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isRoot" className="text-sm text-gray-700">Root Agent</label>
            </div>

            {/* Filename (read-only info) */}
            {getNodeData(selectedNode).filename && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
                <div className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-600 font-mono text-xs">
                  {getNodeData(selectedNode).filename}
                </div>
              </div>
            )}
          </div>

          {/* Delete Button */}
          <button
            onClick={deleteSelectedNode}
            className="mt-4 w-full px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
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
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e5e7eb" />
          <Controls />
          <MiniMap
            nodeColor={minimapNodeColor}
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="!bg-white !border-gray-200"
          />

          {/* Empty State */}
          {nodes.length === 0 && (
            <Panel position="top-center" className="mt-20">
              <div className="text-center bg-white/90 backdrop-blur-sm rounded-xl px-8 py-6 border border-gray-200 shadow-sm">
                <div className="text-4xl mb-3">🤖</div>
                <h3 className="font-semibold text-gray-900 mb-2">Build Your Agent</h3>
                <p className="text-sm text-gray-500 max-w-xs">
                  Drag agents from the palette onto the canvas, then connect them to create your
                  agent workflow.
                </p>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </div>
  );
}

// Wrapper component that provides ReactFlowProvider
export default function AgentComposer(props: AgentComposerProps) {
  return (
    <ReactFlowProvider>
      <AgentComposerInner {...props} />
    </ReactFlowProvider>
  );
}
