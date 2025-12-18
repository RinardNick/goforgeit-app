'use client';

import { useState } from 'react';
import { Bot, ChevronDown } from 'lucide-react';
import { DialogOverlay, DialogCard, DialogHeader, DialogBody, DialogFooter, DialogButton } from './shared';

interface AddAgentToolDialogProps {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  onSave: (agentPath: string) => void;
  availableAgents: string[];
  existingToolPaths: string[];
}

export function AddAgentToolDialog({ open, onClose, onBack, onSave, availableAgents, existingToolPaths }: AddAgentToolDialogProps) {
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

  return (
    <DialogOverlay open={open} onClose={onClose}>
      <DialogCard testId="add-agent-tool-dialog">
        <DialogHeader title="Select Existing Agent" onClose={onClose} onBack={onBack} />
        <DialogBody>
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
        </DialogBody>
        <DialogFooter>
          <DialogButton onClick={onBack}>Back</DialogButton>
          <DialogButton variant="primary" onClick={handleSave} disabled={!selectedAgent} testId="agent-tool-save-button">
            Add Agent Tool
          </DialogButton>
        </DialogFooter>
      </DialogCard>
    </DialogOverlay>
  );
}
