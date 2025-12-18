'use client';

import { useState } from 'react';
import { Plus, Bot } from 'lucide-react';
import { ModeSelectionDialog } from './ModeSelectionDialog';
import { AddAgentToolDialog } from './AddAgentToolDialog';
import { CreateAgentToolDialog, NewAgentToolData } from './CreateAgentToolDialog';
import { AgentToolCard } from './AgentToolCard';

// --- Types ---
export interface AgentToolConfig {
  id: string;
  agentPath: string; // e.g., "calculator_agent.yaml"
  agentName: string; // e.g., "calculator_agent" (derived from path)
}

// Dialog mode type
export type DialogMode = 'closed' | 'select' | 'existing' | 'create';

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
