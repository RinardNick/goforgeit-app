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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-border"
        onClick={e => e.stopPropagation()}
        data-testid="agent-tool-mode-dialog"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <h2 className="text-lg font-heading font-bold text-foreground uppercase tracking-tight">Add Agent Tool</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content - Two Options */}
        <div className="p-5 space-y-3 bg-card">
          <p className="text-sm text-muted-foreground mb-4 font-light">
            Agent Tools allow this agent to delegate tasks to other specialized agents.
          </p>

          {/* Option 1: Select Existing */}
          <button
            type="button"
            data-testid="select-existing-agent-btn"
            onClick={onSelectExisting}
            disabled={!hasAvailableAgents}
            className="w-full flex items-start gap-3 p-4 border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="p-2 rounded-lg bg-primary/10 text-primary shadow-sm">
              <Bot size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Select Existing Agent</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                {hasAvailableAgents
                  ? 'Choose from agents already in this project'
                  : 'No other agents available in this project'}
              </p>
            </div>
            <ChevronDown size={16} className="text-muted-foreground/40 -rotate-90 mt-2" />
          </button>

          {/* Option 2: Create New */}
          <button
            type="button"
            data-testid="create-new-agent-tool-btn"
            onClick={onCreateNew}
            className="w-full flex items-start gap-3 p-4 border border-border rounded-lg hover:border-green-500/50 hover:bg-green-500/5 transition-all text-left"
          >
            <div className="p-2 rounded-lg bg-green-500/10 text-green-500 shadow-sm">
              <Sparkles size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Create New Agent Tool</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                Create a new specialized agent to use as a tool
              </p>
            </div>
            <ChevronDown size={16} className="text-muted-foreground/40 -rotate-90 mt-2" />
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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-border"
        onClick={e => e.stopPropagation()}
        data-testid="add-agent-tool-dialog"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="text-muted-foreground hover:text-foreground p-1 -ml-1 transition-colors">
              <ChevronDown size={16} className="rotate-90" />
            </button>
            <h2 className="text-lg font-heading font-bold text-foreground uppercase tracking-tight">Select Existing Agent</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 bg-card">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 font-mono">
              Select Agent
            </label>
            <p className="text-xs text-muted-foreground/60 mb-3 font-light italic">
              Choose an agent from this project to use as a tool
            </p>

            {/* Custom Select Dropdown */}
            <div className="relative">
              <button
                type="button"
                data-testid="agent-tool-agent-select"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full border border-border rounded-sm px-3 py-3 text-left text-sm bg-background hover:border-primary/50 focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all flex items-center justify-between group shadow-sm"
              >
                <span className={`font-mono ${selectedAgent ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                  {selectedAgent ? selectedAgent.replace('.yaml', '') : 'SELECT_AGENT_MODULE...'}
                </span>
                <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-sm shadow-2xl max-h-48 overflow-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                  {selectableAgents.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-muted-foreground/40 italic font-mono uppercase">
                      NO_AGENTS_AVAILABLE
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
                        className="w-full px-3 py-2.5 text-left text-xs font-mono text-foreground hover:bg-accent flex items-center gap-2 border-b border-border/5 last:border-b-0 transition-colors"
                      >
                        <Bot size={14} className="text-primary opacity-70" />
                        <span>{agent.replace('.yaml', '')}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedAgent && (
            <div className="bg-primary/5 border border-primary/20 rounded-sm p-4 animate-fadeIn">
              <div className="flex items-center gap-2 text-primary">
                <Bot size={16} />
                <span className="text-sm font-bold font-mono uppercase tracking-wide">{selectedAgent.replace('.yaml', '')}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 font-mono leading-relaxed opacity-80">
                PROTOCOL: This agent will be registered as a valid capability for delegation by the current LLM process.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex justify-end gap-3 bg-muted/30">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            Back
          </button>
          <button
            type="button"
            data-testid="agent-tool-save-button"
            onClick={handleSave}
            disabled={!selectedAgent}
            className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest bg-primary text-primary-foreground rounded-sm hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={handleClose}>
      <div
        className="bg-card rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col border border-border"
        onClick={e => e.stopPropagation()}
        data-testid="create-agent-tool-dialog"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="text-muted-foreground hover:text-foreground p-1 -ml-1 transition-colors">
              <ChevronDown size={16} className="rotate-90" />
            </button>
            <h2 className="text-lg font-heading font-bold text-foreground uppercase tracking-tight">Create Agent Module</h2>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 bg-card scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {/* Name */}
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 font-mono">
              Agent Name *
            </label>
            <input
              type="text"
              data-testid="new-agent-tool-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., search_specialist"
              className="w-full bg-background border border-border rounded-sm px-3 py-2.5 text-sm text-foreground font-mono focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none"
            />
            <p className="text-[10px] text-muted-foreground/60 mt-1.5 font-mono uppercase tracking-tighter">IDENTIFIER_MUST_BE_SNAKE_CASE</p>
          </div>

          {/* Model */}
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 font-mono">
              Process Model
            </label>
            <div className="relative">
              <button
                type="button"
                data-testid="new-agent-tool-model"
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                className="w-full bg-background border border-border rounded-sm px-3 py-2.5 text-left text-sm text-foreground hover:border-primary/50 focus:ring-1 focus:ring-primary focus:border-primary transition-all flex items-center justify-between group shadow-sm"
              >
                <span className="font-mono text-xs">
                  {MODELS.find(m => m.value === model)?.label || model}
                </span>
                <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${modelDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {modelDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-sm shadow-2xl overflow-hidden">
                  {MODELS.map(m => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => {
                        setModel(m.value);
                        setModelDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 text-left text-xs font-mono border-b border-border/5 last:border-b-0 hover:bg-accent transition-colors ${model === m.value ? 'text-primary bg-primary/5' : 'text-foreground'}`}
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
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 font-mono">
              Description
            </label>
            <input
              type="text"
              data-testid="new-agent-tool-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Primary objective..."
              className="w-full bg-background border border-border rounded-sm px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
            />
          </div>

          {/* Instruction */}
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 font-mono">
              Protocol Instruction
            </label>
            <textarea
              data-testid="new-agent-tool-instruction"
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              placeholder="You are a specialized agent programmed to..."
              rows={4}
              className="w-full bg-background border border-border rounded-sm px-3 py-2.5 text-xs text-foreground font-mono leading-relaxed focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none transition-all"
            />
          </div>

          {/* Info */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-sm p-4 animate-fadeIn">
            <div className="flex items-center gap-2 text-green-500">
              <Sparkles size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest font-mono">New Component</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 font-mono leading-relaxed opacity-80">
              This will initialize a new sovereign process within the current architecture. It can be further customized post-initialization.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex justify-end gap-3 bg-muted/30 shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            disabled={isLoading}
          >
            Back
          </button>
          <button
            type="button"
            data-testid="create-agent-tool-save-button"
            onClick={handleSave}
            disabled={!name.trim() || isLoading}
            className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest bg-primary text-primary-foreground rounded-sm hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </>
            ) : (
              'Initialize'
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
      className="flex items-center justify-between px-3 py-2 bg-primary/5 border border-primary/20 rounded-sm group hover:border-primary/40 transition-all"
    >
      <button
        type="button"
        onClick={onNavigate}
        className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
        title="Click to edit this agent"
      >
        <div className="p-1.5 rounded-sm bg-primary/10 text-primary shadow-sm">
          <Bot size={14} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-foreground font-heading truncate tracking-tight">{tool.agentName}</span>
          <span className="text-[10px] text-muted-foreground/60 font-mono truncate uppercase">{tool.agentPath}</span>
        </div>
        <ExternalLink size={12} className="text-primary/40 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0" />
      </button>
      <button
        data-testid="delete-agent-tool-button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="p-1.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-sm transition-colors ml-2"
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
        <label className="block text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Agent Tools</label>
        <button
          onClick={() => setDialogMode('select')}
          data-testid="add-agent-tool-button"
          className="p-1 bg-foreground text-background rounded-sm hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
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
            className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-border rounded-sm bg-muted/20"
          >
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground/40 mb-2">
              <Bot size={16} />
            </div>
            <p className="text-[10px] text-muted-foreground/60 uppercase font-mono mb-2">NO_AGENT_MODULES</p>
            <button
              onClick={() => setDialogMode('select')}
              className="text-xs font-bold text-primary hover:text-primary/80 hover:underline uppercase tracking-wide transition-colors"
            >
              Initialize Module
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
        <div className="text-[9px] text-muted-foreground/40 font-mono pt-1.5 border-t border-border uppercase tracking-widest">
          {agentTools.length} MODULE{agentTools.length !== 1 ? 'S' : ''}_CONNECTED
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