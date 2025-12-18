'use client';

import { useState } from 'react';
import { X, ChevronDown, Sparkles } from 'lucide-react';

// New agent data for creating a new agent as tool
export interface NewAgentToolData {
  name: string;
  model: string;
  description: string;
  instruction: string;
}

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

export function CreateAgentToolDialog({ open, onClose, onBack, onSave, isLoading }: CreateAgentToolDialogProps) {
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
}
