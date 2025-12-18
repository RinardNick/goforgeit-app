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

import AgentNode, { AgentNodeData, ADKAgentClass, ToolConfig } from './AgentNode';
import ContainerNode from './ContainerNode';
import { ToolType } from './AddToolsDropdown';
import { AgentPalette } from './AgentPalette';
import { PropertiesPanel } from './PropertiesPanel';

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

  // Tool sections expansion state
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

  return (
    <div className="flex h-full bg-background" onKeyDown={onKeyDown} tabIndex={0} data-testid="agent-composer">
      {/* Agent Palette */}
      {!readOnly && <AgentPalette onDragStart={onDragStart} />}

      {/* Properties Panel */}
      {!readOnly && selectedNode && (
        <PropertiesPanel
          selectedNode={selectedNode}
          expandedToolSections={expandedToolSections}
          onClose={onPaneClick}
          onUpdateData={updateSelectedNodeData}
          onUpdateDataLocal={updateSelectedNodeDataLocal}
          onUpdateToolConfig={updateToolConfig}
          onDelete={deleteSelectedNode}
          onExpandToolSection={handleExpandToolSection}
          onCollapseToolSection={handleCollapseToolSection}
        />
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