'use client';

import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { ADKAgentClass, AgentNodeData } from './AgentNode';

// Agent type dropdown items
const agentTypeDropdownItems: { type: ADKAgentClass; label: string; icon: string }[] = [
  { type: 'LlmAgent', label: 'LLM Agent', icon: '🤖' },
  { type: 'SequentialAgent', label: 'Sequential', icon: '⏭️' },
  { type: 'ParallelAgent', label: 'Parallel', icon: '⚡' },
  { type: 'LoopAgent', label: 'Loop', icon: '🔄' },
];

const containerConfig: Record<
  'SequentialAgent' | 'ParallelAgent' | 'LoopAgent',
  { color: string; bgColor: string; borderColor: string; icon: string; description: string }
> = {
  SequentialAgent: {
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300',
    icon: '⏭️',
    description: 'Executes sub-agents in order',
  },
  ParallelAgent: {
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
    icon: '⚡',
    description: 'Executes sub-agents concurrently',
  },
  LoopAgent: {
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
    icon: '🔄',
    description: 'Iterates over sub-agents',
  },
};

export interface ContainerNodeData extends AgentNodeData {
  childAgents?: Array<{
    name: string;
    agentClass: ADKAgentClass;
    description?: string;
    filename?: string;
  }>;
  onAgentDroppedInContainer?: (containerId: string, containerFilename: string, droppedAgentFilename: string) => void;
  onAddSubAgent?: (containerId: string, childAgentClass: ADKAgentClass) => void;
  onRemoveFromContainer?: (containerFilename: string, childFilename: string) => void;
}

interface ContainerNodeProps {
  id: string;
  data: ContainerNodeData;
  selected?: boolean;
}

function ContainerNode({ id, data, selected }: ContainerNodeProps) {
  const reactFlowInstance = useReactFlow();
  const agentClass = data.agentClass as 'SequentialAgent' | 'ParallelAgent' | 'LoopAgent';
  const config = containerConfig[agentClass];
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Handle agent type selection for sub-agent
  const handleSelectSubAgentType = useCallback((agentType: ADKAgentClass) => {
    setShowDropdown(false);
    if (data.onAddSubAgent) {
      data.onAddSubAgent(id, agentType);
    }
  }, [data, id]);

  // Handle drop on container's drop zone
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // Get the dragged node ID from the data transfer
    const droppedNodeId = event.dataTransfer.getData('application/reactflow/nodeId');
    if (!droppedNodeId || droppedNodeId === id) return; // Can't drop on self

    // Get the dropped node's data
    const droppedNode = reactFlowInstance.getNode(droppedNodeId);
    if (!droppedNode) return;

    const droppedNodeData = droppedNode.data as AgentNodeData;
    if (!droppedNodeData.filename) return;

    // Call the callback to handle adding the dropped agent to this container
    if (data.onAgentDroppedInContainer && data.filename) {
      data.onAgentDroppedInContainer(id, data.filename, droppedNodeData.filename);
    }
  }, [id, data, reactFlowInstance]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  if (!config) {
    return null;
  }

  const testIdSuffix = agentClass.replace('Agent', '').toLowerCase();

  return (
    <div
      className={`
        rounded-lg border-2 shadow-sm min-w-[280px]
        ${config.bgColor} ${config.borderColor}
        ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
        ${data.isRoot ? 'border-l-4 border-l-blue-500' : ''}
      `}
      data-testid={`container-node-${testIdSuffix}`}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-gray-400 border-2 border-white"
      />

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate text-sm">{data.name}</h3>
            <span className={`text-xs font-medium ${config.color}`}>{data.agentClass}</span>
          </div>
          {data.isRoot && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
              Root
            </span>
          )}
        </div>

        {/* Description */}
        {data.description && (
          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{data.description}</p>
        )}
      </div>

      {/* Drop Zone / Children Container */}
      <div
        className={`
          p-3 min-h-[80px]
          ${agentClass === 'ParallelAgent' ? 'flex flex-row gap-2 flex-wrap items-start' : 'flex flex-col gap-2'}
        `}
        data-testid="container-drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {data.childAgents && data.childAgents.length > 0 ? (
          data.childAgents.map((child, index) => (
            <div
              key={child.name || index}
              className="px-3 py-2 bg-white rounded border border-gray-200 shadow-sm group"
              data-testid="container-child-agent"
            >
              <div className="flex items-center gap-2">
                {/* Drag handle */}
                <span
                  className="cursor-grab text-gray-400 hover:text-gray-600"
                  data-testid="child-drag-handle"
                  title="Drag to reorder"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm6-12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
                  </svg>
                </span>
                <span className="text-sm">
                  {child.agentClass === 'LlmAgent' ? '🤖' :
                   child.agentClass === 'SequentialAgent' ? '⏭️' :
                   child.agentClass === 'ParallelAgent' ? '⚡' : '🔄'}
                </span>
                <span className="text-xs font-medium text-gray-700 truncate flex-1">{child.name}</span>
                {/* Remove button */}
                {child.filename && data.onRemoveFromContainer && data.filename && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onRemoveFromContainer!(data.filename!, child.filename!);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                    data-testid="remove-from-container-button"
                    title="Remove from container"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {child.description && (
                <p className="text-xs text-gray-500 mt-1 truncate">{child.description}</p>
              )}
            </div>
          ))
        ) : null}

        {/* Plus button to add sub-agent */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handlePlusClick}
            className="w-8 h-8 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 flex items-center justify-center hover:border-blue-500 hover:text-blue-500 transition-colors"
            data-testid="container-add-button"
            title="Add sub-agent"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {/* Agent type dropdown */}
          {showDropdown && (
            <div
              className="absolute top-10 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[140px]"
              data-testid="agent-type-dropdown"
            >
              {agentTypeDropdownItems.map((item) => (
                <button
                  key={item.type}
                  onClick={() => handleSelectSubAgentType(item.type)}
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

      {/* Loop indicator for LoopAgent */}
      {agentClass === 'LoopAgent' && (
        <div className="px-4 py-2 border-t border-gray-200 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            🔄 Loop until complete
          </span>
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-gray-400 border-2 border-white"
      />
    </div>
  );
}

export default memo(ContainerNode);
