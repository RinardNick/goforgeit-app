'use client';

import { X, Bot, ChevronDown, Sparkles } from 'lucide-react';

interface ModeSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectExisting: () => void;
  onCreateNew: () => void;
  hasAvailableAgents: boolean;
}

export function ModeSelectionDialog({ open, onClose, onSelectExisting, onCreateNew, hasAvailableAgents }: ModeSelectionDialogProps) {
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
}
