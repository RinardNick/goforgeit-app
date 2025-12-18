'use client';

import { Bot, Trash2, ExternalLink } from 'lucide-react';
import { AgentToolConfig } from './AgentToolsPanel';

interface AgentToolCardProps {
  tool: AgentToolConfig;
  onDelete: () => void;
  onNavigate?: () => void;
}

export function AgentToolCard({ tool, onDelete, onNavigate }: AgentToolCardProps) {
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
}
