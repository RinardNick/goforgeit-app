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
    color: 'text-purple-400',
    bgColor: 'bg-charcoal/90 backdrop-blur-md',
    borderColor: 'border-white/10',
    icon: '⏭️',
    description: 'Executes sub-agents in order',
  },
  ParallelAgent: {
    color: 'text-forgeGreen',
    bgColor: 'bg-charcoal/90 backdrop-blur-md',
    borderColor: 'border-white/10',
    icon: '⚡',
    description: 'Executes sub-agents concurrently',
  },
  LoopAgent: {
    color: 'text-orange-400',
    bgColor: 'bg-charcoal/90 backdrop-blur-md',
    borderColor: 'border-white/10',
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
        rounded-sm border-2 shadow-lg min-w-[280px] relative overflow-hidden
        ${selected ? 'bg-charcoal border-electricOrange/50 shadow-[0_0_25px_rgba(255,107,0,0.3)]' : `${config.bgColor} border-white/10`}
        ${data.isRoot ? 'border-l-4 border-l-electricOrange' : ''}
        transition-all duration-500 group
      `}
      data-testid={`container-node-${testIdSuffix}`}
    >
      {/* Ignition Borders - Animate on Select or Hover */}
      <div className={`absolute top-0 left-0 w-full h-[2px] bg-electricOrange origin-center transition-transform duration-500 ease-out ${selected ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
      <div className={`absolute bottom-0 left-0 w-full h-[2px] bg-electricOrange origin-center transition-transform duration-500 ease-out ${selected ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
      <div className={`absolute top-0 left-0 h-full w-[2px] bg-electricOrange origin-center transition-transform duration-500 ease-out ${selected ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100'}`} />
      <div className={`absolute top-0 right-0 h-full w-[2px] bg-electricOrange origin-center transition-transform duration-500 ease-out ${selected ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100'}`} />

      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className={`w-3 h-3 border-2 transition-colors ${selected ? '!bg-electricOrange border-white' : '!bg-charcoal border-electricOrange'}`}
      />

      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 relative z-10">
        <div className="flex items-center gap-2">
          <span className="text-lg opacity-90">{config.icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold font-heading text-warmWhite truncate text-sm tracking-wide">{data.name}</h3>
            <span className={`text-[10px] font-mono font-medium ${config.color} uppercase`}>{data.agentClass}</span>
          </div>
          {data.isRoot && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-electricOrange text-white rounded-sm font-mono uppercase tracking-wider">
              Root
            </span>
          )}
        </div>

        {/* Description */}
        {data.description && (
          <p className="text-xs text-silver/80 mt-1 line-clamp-2 leading-relaxed">{data.description}</p>
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
              className="px-3 py-2 bg-white/5 rounded-sm border border-white/5 shadow-sm group hover:border-white/20 transition-colors"
              data-testid="container-child-agent"
            >
              <div className="flex items-center gap-2">
                {/* Drag handle */}
                <span
                  className="cursor-grab text-silver/40 hover:text-white"
                  data-testid="child-drag-handle"
                  title="Drag to reorder"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm6-12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
                  </svg>
                </span>
                <span className="text-sm opacity-80">
                  {child.agentClass === 'LlmAgent' ? '🤖' :
                   child.agentClass === 'SequentialAgent' ? '⏭️' :
                   child.agentClass === 'ParallelAgent' ? '⚡' : '🔄'}
                </span>
                <span className="text-xs font-medium text-warmWhite truncate flex-1">{child.name}</span>
                {/* Remove button */}
                {child.filename && data.onRemoveFromContainer && data.filename && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onRemoveFromContainer!(data.filename!, child.filename!);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-silver/40 hover:text-red-400 transition-opacity"
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
                <p className="text-[10px] text-silver/60 mt-1 truncate">{child.description}</p>
              )}
            </div>
          ))
        ) : null}

        {/* Plus button to add sub-agent */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handlePlusClick}
            className="w-8 h-8 rounded-sm border-2 border-dashed border-white/10 text-silver/40 flex items-center justify-center hover:border-electricOrange/50 hover:text-electricOrange transition-colors"
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
              className="absolute top-10 left-0 bg-charcoal border border-white/10 rounded-sm shadow-xl py-1 z-50 min-w-[140px]"
              data-testid="agent-type-dropdown"
            >
              {agentTypeDropdownItems.map((item) => (
                <button
                  key={item.type}
                  onClick={() => handleSelectSubAgentType(item.type)}
                  className="w-full px-3 py-2 text-left text-xs font-mono text-silver hover:bg-white/5 hover:text-white flex items-center gap-2"
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
        <div className="px-4 py-2 border-t border-white/10 text-xs text-silver/60 font-mono">
          <span className="inline-flex items-center gap-1">
            🔄 Loop until complete
          </span>
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className={`w-3 h-3 border-2 transition-colors ${selected ? '!bg-electricOrange border-white' : '!bg-charcoal border-electricOrange'}`}
      />
    </div>
  );
}

export default memo(ContainerNode);
