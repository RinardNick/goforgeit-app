'use client';

import { Bot, ChevronDown, Sparkles } from 'lucide-react';
import { DialogOverlay, DialogCard, DialogHeader, DialogBody } from './shared';

interface ModeSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectExisting: () => void;
  onCreateNew: () => void;
  hasAvailableAgents: boolean;
}

export function ModeSelectionDialog({ open, onClose, onSelectExisting, onCreateNew, hasAvailableAgents }: ModeSelectionDialogProps) {
  return (
    <DialogOverlay open={open} onClose={onClose}>
      <DialogCard testId="agent-tool-mode-dialog">
        <DialogHeader title="Add Agent Tool" onClose={onClose} />
        <DialogBody>
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
        </DialogBody>
      </DialogCard>
    </DialogOverlay>
  );
}
