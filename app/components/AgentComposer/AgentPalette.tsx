'use client';

import { ADKAgentClass } from './AgentNode';

// Agent palette items for drag-and-drop
const agentPaletteItems: { type: ADKAgentClass; label: string; icon: string }[] = [
  { type: 'LlmAgent', label: 'LLM Agent', icon: '🤖' },
  { type: 'SequentialAgent', label: 'Sequential', icon: '⏭️' },
  { type: 'ParallelAgent', label: 'Parallel', icon: '⚡' },
  { type: 'LoopAgent', label: 'Loop', icon: '🔄' },
];

interface AgentPaletteProps {
  onDragStart: (event: React.DragEvent, agentType: ADKAgentClass) => void;
}

export function AgentPalette({ onDragStart }: AgentPaletteProps) {
  return (
    <div className="w-56 bg-card/30 border-r border-border p-4 flex flex-col backdrop-blur-sm" data-testid="agent-palette">
      <h3 className="font-heading font-bold text-foreground mb-3 uppercase text-xs tracking-wider">Components</h3>
      <p className="text-[10px] text-muted-foreground/50 mb-4 font-mono">DRAG TO CANVAS</p>
      <div className="space-y-2">
        {agentPaletteItems.map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => onDragStart(e, item.type)}
            data-testid={`palette-${item.type.toLowerCase().replace('agent', '-agent')}`}
            className="flex items-center gap-3 px-3 py-2 bg-accent border border-accent rounded-sm cursor-grab hover:bg-accent/80 hover:border-primary/30 hover:text-primary transition-all duration-200 group"
          >
            <span className="text-lg opacity-80 group-hover:opacity-100">{item.icon}</span>
            <span className="text-xs font-mono text-muted-foreground group-hover:text-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Export palette items for use in other components
export { agentPaletteItems };
