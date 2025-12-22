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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import AgentNode, { AgentNodeData, ADKAgentClass, ToolConfig, MCPServerConfig } from './AgentNode';
import ContainerNode from './ContainerNode';
import { ToolType } from './AddToolsDropdown';
import { PropertiesPanel, ValidationError } from './PropertiesPanel';

// Agent type options for the empty state
const agentTypeOptions: { type: ADKAgentClass; label: string; icon: string; description: string }[] = [
  { type: 'LlmAgent', label: 'LLM Agent', icon: '🤖', description: 'Single LLM-powered agent' },
  { type: 'SequentialAgent', label: 'Sequential', icon: '⏭️', description: 'Executes sub-agents in order' },
  { type: 'ParallelAgent', label: 'Parallel', icon: '⚡', description: 'Executes sub-agents concurrently' },
  { type: 'LoopAgent', label: 'Loop', icon: '🔄', description: 'Iterates over sub-agents' },
];

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

interface AgentComposerProps {
  projectName: string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  availableAgents?: string[];
  files?: Array<{ filename: string; yaml: string }>;
  onSaveFile?: (filename: string, content: string) => Promise<void>;
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
  files = [],
  onSaveFile,
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

  // Tool sections expansion state
  const [expandedToolSections, setExpandedToolSections] = useState<Record<string, Set<ToolType>>>({});

  // Unified Debug Panel state (MCP)
  const [mcpServerStates, setMcpServerStates] = useState<
    Record<string, { status: 'connected' | 'disconnected' | 'error' | 'connecting'; tools: Array<{ name: string; description: string; enabled: boolean }>; errorMessage?: string }>
  >({});

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

  // Use a ref to track the selected node ID to avoid infinite loops
  const selectedNodeIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedNodeIdRef.current = selectedNode?.id ?? null;
  }, [selectedNode]);

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

    // Update selected node reference if it still exists
    const currentSelectedId = selectedNodeIdRef.current;
    if (currentSelectedId) {
      const updatedSelectedNode = nodesWithCallbacks.find(n => n.id === currentSelectedId);
      if (updatedSelectedNode) {
        setSelectedNode(updatedSelectedNode);
      } else {
        setSelectedNode(null);
        onNodeSelect?.(null);
      }
    }
  }, [initialNodes, validationResults, setNodes, handleAddChildAgent, handleAddSubAgent, handleAgentDroppedInContainer, handleRemoveFromContainer, onNodeSelect]);

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

  // Create a new root agent from the empty state
  const createNewAgent = useCallback(
    async (agentType: ADKAgentClass) => {
      const nodeData: AgentNodeData = {
        name: `New ${agentType.replace('Agent', '')}`,
        agentClass: agentType,
        model: agentType === 'LlmAgent' ? 'gemini-2.0-flash-exp' : undefined,
        description: '',
        isRoot: true,
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
        position: { x: 250, y: 150 },
        data: nodeData,
      };

      const newNodes = [...nodes, newNode];
      setNodes(newNodes);
      setSelectedNode(newNode);
      onNodeSelect?.(newNode);
      notifyChange(newNodes, edges);
    },
    [nodes, edges, setNodes, notifyChange, onNodeCreate, onNodeSelect]
  );

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

  // MCP Handlers
  const validateMcpServer = useCallback(async (serverId: string, config: MCPServerConfig) => {
    setMcpServerStates(prev => ({
      ...prev,
      [serverId]: { status: 'connecting', tools: prev[serverId]?.tools || [], errorMessage: undefined },
    }));

    try {
      const response = await fetch('/api/mcp/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: config.type,
          command: config.command,
          args: config.args,
          env: config.env,
          url: config.url,
          headers: config.headers,
        }),
      });

      const data = await response.json();
      const status = data.status === 'connected' ? 'connected' : 'error';
      const tools = (data.tools || []).map((t: any) => ({
        name: t.name,
        description: t.description,
        enabled: true,
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
          errorMessage: error instanceof Error ? error.message : 'Failed to validate'
        },
      }));
    }
  }, []);

  const handleAddMcpServer = useCallback((config: Omit<MCPServerConfig, 'id' | 'status' | 'tools'>) => {
    if (!selectedNode) return;
    const newServer: MCPServerConfig = { ...config, id: crypto.randomUUID(), status: 'disconnected', tools: [] };
    
    // We update the data via updateSelectedNodeData which handles persistence
    // But we need to pass the FULL array of servers
    setNodes((prevNodes) => {
      const currentNode = prevNodes.find(n => n.id === selectedNode.id);
      if (!currentNode) return prevNodes;
      
      const currentData = currentNode.data as AgentNodeData;
      const servers = currentData.mcpServers || [];
      const newServers = [...servers, newServer];
      
      const newData = { ...currentData, mcpServers: newServers };
      const newNodes = prevNodes.map((n) =>
        n.id === selectedNode.id ? { ...n, data: newData } : n
      );
      
      setSelectedNode({ ...selectedNode, data: newData });
      notifyChange(newNodes, edges);
      onNodeDataChange?.(selectedNode.id, newData);
      
      return newNodes;
    });
    
    // Validate immediately
    validateMcpServer(newServer.id, newServer);
  }, [selectedNode, edges, setNodes, notifyChange, onNodeDataChange, validateMcpServer]);

  const handleDeleteMcpServer = useCallback((id: string) => {
    if (!selectedNode) return;
    
    setNodes((prevNodes) => {
      const currentNode = prevNodes.find(n => n.id === selectedNode.id);
      if (!currentNode) return prevNodes;
      
      const currentData = currentNode.data as AgentNodeData;
      const servers = currentData.mcpServers || [];
      const newServers = servers.filter(s => s.id !== id);
      
      const newData = { ...currentData, mcpServers: newServers };
      const newNodes = prevNodes.map((n) =>
        n.id === selectedNode.id ? { ...n, data: newData } : n
      );
      
      setSelectedNode({ ...selectedNode, data: newData });
      notifyChange(newNodes, edges);
      onNodeDataChange?.(selectedNode.id, newData);
      
      return newNodes;
    });

    // Cleanup state
    setMcpServerStates(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [selectedNode, edges, setNodes, notifyChange, onNodeDataChange]);

  const handleToggleMcpTool = useCallback((serverId: string, toolName: string) => {
    setMcpServerStates(prev => {
      const serverState = prev[serverId];
      if (!serverState) return prev;
      return {
        ...prev,
        [serverId]: {
          ...serverState,
          tools: serverState.tools.map(t => t.name === toolName ? { ...t, enabled: !t.enabled } : t)
        }
      };
    });
  }, []);

  const handleRefreshMcpServer = useCallback((serverId: string) => {
    if (!selectedNode) return;
    const nodeData = getNodeData(selectedNode);
    const server = nodeData.mcpServers?.find(s => s.id === serverId);
    if (server) {
      validateMcpServer(serverId, server);
    }
  }, [selectedNode, validateMcpServer]);

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

  // Handler functions for tool sections
  const handleExpandToolSection = useCallback((nodeId: string, type: ToolType) => {
    setExpandedToolSections(prev => {
      const currentSet = prev[nodeId] || new Set<ToolType>();
      const newSet = new Set(currentSet);
      newSet.add(type);
      return { ...prev, [nodeId]: newSet };
    });
  }, []);

  const handleCollapseToolSection = useCallback((nodeId: string, type: ToolType) => {
    setExpandedToolSections(prev => {
      const currentSet = prev[nodeId] || new Set<ToolType>();
      const newSet = new Set(currentSet);
      newSet.delete(type);
      return { ...prev, [nodeId]: newSet };
    });
  }, []);

  // Minimap node color based on agent type
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

  const isEmpty = nodes.length === 0;

  return (
    <div className="flex h-full bg-background" onKeyDown={onKeyDown} tabIndex={0} data-testid="agent-composer">
      {/* Properties Panel */}
      {!readOnly && selectedNode && (() => {
        const nodeData = selectedNode.data as AgentNodeData;
        const filename = nodeData.filename;
        const selectedNodeValidationErrors: ValidationError[] =
          filename && validationResults[filename] && !validationResults[filename].valid
            ? validationResults[filename].errors
            : [];
        return (
          <PropertiesPanel
            files={files}
            selectedNode={selectedNode}
            expandedToolSections={expandedToolSections}
            validationErrors={selectedNodeValidationErrors}
            mcpServerStates={mcpServerStates}
            onClose={onPaneClick}
            onUpdateData={updateSelectedNodeData}
            onUpdateToolConfig={updateToolConfig}
            onDelete={deleteSelectedNode}
            onExpandToolSection={handleExpandToolSection}
            onCollapseToolSection={handleCollapseToolSection}
            onAddMcpServer={handleAddMcpServer}
            onDeleteMcpServer={handleDeleteMcpServer}
            onToggleMcpTool={handleToggleMcpTool}
            onRefreshMcpServer={handleRefreshMcpServer}
            onSaveFile={onSaveFile}
          />
        );
      })()}

      {/* Canvas */}
      <div className="flex-1 h-full relative" style={{ minHeight: '400px' }} data-testid="agent-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={readOnly ? undefined : onNodesChange}
          onEdgesChange={readOnly ? undefined : onEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="var(--muted-foreground)" className="opacity-20" />
          <Controls className="!bg-card/80 !border-border !fill-foreground/80" />
          <MiniMap nodeColor={minimapNodeColor} maskColor="rgba(10, 25, 49, 0.6)" />
        </ReactFlow>

        {/* Empty State */}
        {isEmpty && !readOnly && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto bg-card/95 backdrop-blur-sm border border-border rounded-lg p-8 shadow-2xl max-w-md">
              <h3 className="text-lg font-heading font-bold text-foreground mb-2 text-center">Create Your First Agent</h3>
              <p className="text-sm text-muted-foreground mb-6 text-center">
                Select an agent type to get started. You can add more agents by clicking the + button on any agent card.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {agentTypeOptions.map((option) => (
                  <button
                    key={option.type}
                    onClick={() => createNewAgent(option.type)}
                    className="flex flex-col items-center gap-2 p-4 border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-all text-center group"
                    data-testid={`create-${option.type.toLowerCase()}`}
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">{option.icon}</span>
                    <span className="text-sm font-bold text-foreground">{option.label}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
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
