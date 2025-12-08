'use client';

import React, { useState } from 'react';
import { Plus, Bot, X, Trash2, ChevronDown, ExternalLink, Sparkles } from 'lucide-react';

// --- Types ---
export interface AgentToolConfig {
  id: string;
  agentPath: string; // e.g., "calculator_agent.yaml"
  agentName: string; // e.g., "calculator_agent" (derived from path)
}

// New agent data for creating a new agent as tool
export interface NewAgentToolData {
  name: string;
  model: string;
  description: string;
  instruction: string;
}

// --- Props ---
interface AgentToolsPanelProps {
  agentTools: AgentToolConfig[];
  availableAgents: string[]; // List of available agent filenames in the project
  currentAgentFilename?: string; // To exclude current agent from being added as tool
  onAddAgentTool: (agentPath: string) => void;
  onCreateNewAgentTool: (data: NewAgentToolData) => Promise<string>; // Returns the new agent's filename
  onDeleteAgentTool: (id: string) => void;
  onNavigateToAgent?: (agentFilename: string) => void; // Navigate to agent node on canvas
  dialogMode: DialogMode; // Lifted state
  setDialogMode: (mode: DialogMode) => void; // Lifted state setter
}

// --- Mode Selection Dialog (Choose between existing or create new) ---
interface ModeSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectExisting: () => void;
  onCreateNew: () => void;
  hasAvailableAgents: boolean;
}

const ModeSelectionDialog = ({ open, onClose, onSelectExisting, onCreateNew, hasAvailableAgents }: ModeSelectionDialogProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
        data-testid="agent-tool-mode-dialog"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Add Agent Tool</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Content - Two Options */}
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-500 mb-4">
            Agent Tools allow this agent to delegate tasks to other specialized agents.
          </p>

          {/* Option 1: Select Existing */}
          <button
            type="button"
            data-testid="select-existing-agent-btn"
            onClick={onSelectExisting}
            disabled={!hasAvailableAgents}
            className="w-full flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-white"
          >
            <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
              <Bot size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Select Existing Agent</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {hasAvailableAgents
                  ? 'Choose from agents already in this project'
                  : 'No other agents available in this project'}
              </p>
            </div>
            <ChevronDown size={16} className="text-gray-400 -rotate-90 mt-2" />
          </button>

          {/* Option 2: Create New */}
          <button
            type="button"
            data-testid="create-new-agent-tool-btn"
            onClick={onCreateNew}
            className="w-full flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50/50 transition-all text-left"
          >
            <div className="p-2 rounded-lg bg-green-100 text-green-600">
              <Sparkles size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Create New Agent Tool</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Create a new specialized agent to use as a tool
              </p>
            </div>
            <ChevronDown size={16} className="text-gray-400 -rotate-90 mt-2" />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Add Agent Tool Dialog (Select Existing) ---
interface AddAgentToolDialogProps {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  onSave: (agentPath: string) => void;
  availableAgents: string[];
  existingToolPaths: string[];
}

const AddAgentToolDialog = ({ open, onClose, onBack, onSave, availableAgents, existingToolPaths }: AddAgentToolDialogProps) => {
  const [selectedAgent, setSelectedAgent] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Filter out agents that are already added as tools
  const selectableAgents = availableAgents.filter(agent => !existingToolPaths.includes(agent));

  const handleSave = () => {
    if (!selectedAgent) return;
    onSave(selectedAgent);
    setSelectedAgent('');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
        data-testid="add-agent-tool-dialog"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="text-gray-400 hover:text-gray-600 p-1 -ml-1">
              <ChevronDown size={16} className="rotate-90" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">Select Existing Agent</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Select Agent
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Choose an agent from this project to use as a tool
            </p>

            {/* Custom Select Dropdown */}
            <div className="relative">
              <button
                type="button"
                data-testid="agent-tool-agent-select"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-left text-sm bg-white hover:border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all flex items-center justify-between"
              >
                <span className={selectedAgent ? 'text-gray-900' : 'text-gray-400'}>
                  {selectedAgent ? selectedAgent.replace('.yaml', '') : 'Select an agent...'}
                </span>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                  {selectableAgents.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-400 italic">
                      No available agents
                    </div>
                  ) : (
                    selectableAgents.map(agent => (
                      <button
                        key={agent}
                        type="button"
                        onClick={() => {
                          setSelectedAgent(agent);
                          setIsOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Bot size={14} className="text-purple-500" />
                        <span>{agent.replace('.yaml', '')}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedAgent && (
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
              <div className="flex items-center gap-2 text-purple-700">
                <Bot size={16} />
                <span className="text-sm font-medium">{selectedAgent.replace('.yaml', '')}</span>
              </div>
              <p className="text-xs text-purple-600 mt-1">
                This agent will be available as a tool for the LLM to call
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Back
          </button>
          <button
            type="button"
            data-testid="agent-tool-save-button"
            onClick={handleSave}
            disabled={!selectedAgent}
            className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Agent Tool
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Create New Agent Tool Dialog ---
interface CreateAgentToolDialogProps {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  onSave: (data: NewAgentToolData) => void;
  isLoading?: boolean;
}

const MODELS = [
  { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Fast)' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Capable)' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Balanced)' },
];

const CreateAgentToolDialog = ({ open, onClose, onBack, onSave, isLoading }: CreateAgentToolDialogProps) => {
  const [name, setName] = useState('');
  const [model, setModel] = useState('gemini-2.0-flash-exp');
  const [description, setDescription] = useState('');
  const [instruction, setInstruction] = useState('');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim().toLowerCase().replace(/\s+/g, '_'),
      model,
      description: description.trim(),
      instruction: instruction.trim(),
    });
  };

  const handleClose = () => {
    setName('');
    setModel('gemini-2.0-flash-exp');
    setDescription('');
    setInstruction('');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        data-testid="create-agent-tool-dialog"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="text-gray-400 hover:text-gray-600 p-1 -ml-1">
              <ChevronDown size={16} className="rotate-90" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">Create New Agent Tool</h2>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Agent Name *
            </label>
            <input
              type="text"
              data-testid="new-agent-tool-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., search_specialist"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">Use snake_case for naming</p>
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Model
            </label>
            <div className="relative">
              <button
                type="button"
                data-testid="new-agent-tool-model"
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-left text-sm bg-white hover:border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all flex items-center justify-between"
              >
                <span className="text-gray-900">
                  {MODELS.find(m => m.value === model)?.label || model}
                </span>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {modelDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                  {MODELS.map(m => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => {
                        setModel(m.value);
                        setModelDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${model === m.value ? 'bg-blue-50 text-blue-700' : ''}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Description
            </label>
            <input
              type="text"
              data-testid="new-agent-tool-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="A specialized agent for..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Instruction */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              System Instruction
            </label>
            <textarea
              data-testid="new-agent-tool-instruction"
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              placeholder="You are a specialized agent that..."
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          {/* Info */}
          <div className="bg-green-50 border border-green-100 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-700">
              <Sparkles size={16} />
              <span className="text-sm font-medium">New Agent Tool</span>
            </div>
            <p className="text-xs text-green-600 mt-1">
              This will create a new agent in your project that can be called as a tool by the parent agent.
              You can edit it further by clicking on the agent card.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            disabled={isLoading}
          >
            Back
          </button>
          <button
            type="button"
            data-testid="create-agent-tool-save-button"
            onClick={handleSave}
            disabled={!name.trim() || isLoading}
            className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating...
              </>
            ) : (
              'Create Agent Tool'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Agent Tool Card ---
interface AgentToolCardProps {
  tool: AgentToolConfig;
  onDelete: () => void;
  onNavigate?: () => void;
}

const AgentToolCard = ({ tool, onDelete, onNavigate }: AgentToolCardProps) => {
  return (
    <div
      data-testid={`agent-tool-card-${tool.agentName}`}
      className="flex items-center justify-between px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg group"
    >
      <button
        type="button"
        onClick={onNavigate}
        className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
        title="Click to edit this agent"
      >
        <div className="p-1.5 rounded-md bg-purple-100 text-purple-600">
          <Bot size={14} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-gray-900 truncate">{tool.agentName}</span>
          <span className="text-[10px] text-gray-400 font-mono truncate">{tool.agentPath}</span>
        </div>
        <ExternalLink size={12} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0" />
      </button>
      <button
        data-testid="delete-agent-tool-button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors ml-2"
        title="Remove Agent Tool"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};

// Dialog mode type
export type DialogMode = 'closed' | 'select' | 'existing' | 'create';

// --- Main Panel ---
export default function AgentToolsPanel({
  agentTools,
  availableAgents,
  currentAgentFilename,
  onAddAgentTool,
  onCreateNewAgentTool,
  onDeleteAgentTool,
  onNavigateToAgent,
  dialogMode,
  setDialogMode,
}: AgentToolsPanelProps) {
  const [isCreating, setIsCreating] = useState(false);

  // Filter out the current agent from available agents
  const filteredAvailableAgents = availableAgents.filter(
    agent => agent !== currentAgentFilename
  );

  // Get existing tool paths for filtering in the dialog
  const existingToolPaths = agentTools.map(t => t.agentPath);

  // Check if there are agents available to select (excluding already added ones)
  const hasAvailableAgents = filteredAvailableAgents.filter(
    agent => !existingToolPaths.includes(agent)
  ).length > 0;

  const handleCreateNewAgent = async (data: NewAgentToolData) => {
    setIsCreating(true);
    try {
      const newAgentFilename = await onCreateNewAgentTool(data);
      // After creating, add it as a tool to the current agent
      onAddAgentTool(newAgentFilename);
      setDialogMode('closed');
      
      // Auto-navigate to the new agent if navigation callback is provided
      if (onNavigateToAgent) {
        onNavigateToAgent(newAgentFilename);
      }
    } catch (error) {
      console.error('Failed to create new agent tool:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div data-testid="agent-tools-section" className="space-y-3">
      {/* Header */}
      <div className="flex justify-between items-center">
        <label className="block text-sm font-medium text-gray-700">Agent Tools</label>
        <button
          onClick={() => setDialogMode('select')}
          data-testid="add-agent-tool-button"
          className="p-1 bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
          title="Add Agent Tool"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Agent Tools List */}
      <div className="space-y-2">
        {agentTools.length === 0 ? (
          <div
            data-testid="agent-tools-empty-state"
            className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50/50"
          >
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-2">
              <Bot size={16} />
            </div>
            <p className="text-xs text-gray-500 mb-2">No agent tools configured</p>
            <button
              onClick={() => setDialogMode('select')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              Add your first agent tool
            </button>
          </div>
        ) : (
          agentTools.map(tool => (
            <AgentToolCard
              key={tool.id}
              tool={tool}
              onDelete={() => onDeleteAgentTool(tool.id)}
              onNavigate={() => onNavigateToAgent?.(tool.agentPath)}
            />
          ))
        )}
      </div>

      {/* Footer Summary */}
      {agentTools.length > 0 && (
        <div className="text-[10px] text-gray-400 font-mono pt-1 border-t border-gray-100">
          {agentTools.length} agent tool{agentTools.length !== 1 ? 's' : ''} configured
        </div>
      )}

      {/* Mode Selection Dialog */}
      <ModeSelectionDialog
        open={dialogMode === 'select'}
        onClose={() => setDialogMode('closed')}
        onSelectExisting={() => setDialogMode('existing')}
        onCreateNew={() => setDialogMode('create')}
        hasAvailableAgents={hasAvailableAgents}
      />

      {/* Select Existing Agent Dialog */}
      <AddAgentToolDialog
        open={dialogMode === 'existing'}
        onClose={() => setDialogMode('closed')}
        onBack={() => setDialogMode('select')}
        onSave={onAddAgentTool}
        availableAgents={filteredAvailableAgents}
        existingToolPaths={existingToolPaths}
      />

      {/* Create New Agent Dialog */}
      <CreateAgentToolDialog
        open={dialogMode === 'create'}
        onClose={() => setDialogMode('closed')}
        onBack={() => setDialogMode('select')}
        onSave={handleCreateNewAgent}
        isLoading={isCreating}
      />
    </div>
  );
}
