'use client';

import React, { useState } from 'react';
import { 
  Wrench, 
  Plus, 
  Search, 
  FileCode, 
  Globe, 
  Bot, 
  Plug, 
  X,
  ExternalLink,
  Trash2,
  Edit3
} from 'lucide-react';
import { AgentFile } from '@/lib/adk/nodes';

interface ToolRegistryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  files: AgentFile[];
  projectName: string;
  onEditTool?: (filename: string, content: string) => void;
  onDeleteTool?: (filename: string) => void;
  onNavigateToAgent?: (filename: string) => void;
  onNewCustomTool?: () => void;
}

export function ToolRegistryPanel({
  isOpen,
  onClose,
  files,
  projectName,
  onEditTool,
  onDeleteTool,
  onNavigateToAgent,
  onNewCustomTool,
}: ToolRegistryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  // Categorize tools
  const pythonTools = files.filter(f => 
    f.filename.startsWith('tools/') && 
    f.filename.endsWith('.py') && 
    !f.filename.endsWith('__init__.py')
  );
  const agentTools = files.filter(f => f.filename !== 'root_agent.yaml' && f.filename.endsWith('.yaml'));
  
  // Built-in tools (standard ADK tools)
  const builtinTools = [
    { name: 'google_search', description: 'Search the web using Google' },
    { name: 'built_in_code_execution', description: 'Execute Python code in a sandbox' },
    { name: 'VertexAiSearchTool', description: 'Search through unstructured data using Vertex AI Search' },
    { name: 'VertexAiRagRetrieval', description: 'Retrieve context from a RAG corpus' },
  ];

  const filteredPythonTools = pythonTools.filter(t => 
    t.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAgentTools = agentTools.filter(t => 
    t.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-y-0 right-0 w-[400px] bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <Wrench size={18} className="text-primary" />
          <h2 className="text-lg font-heading font-bold text-foreground uppercase tracking-tight">Tool Registry</h2>
        </div>
        <button 
          onClick={onClose}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-sm hover:bg-accent"
        >
          <X size={20} />
        </button>
      </div>

      {/* Search & Actions */}
      <div className="p-4 border-b border-border space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <input
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-sm text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={onNewCustomTool}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-sm text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all shadow-md"
          >
            <Plus size={14} /> New Custom Tool
          </button>
          <button className="flex items-center justify-center gap-2 px-3 py-2 bg-accent text-foreground border border-border rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-muted transition-all">
            <Plug size={14} /> Add MCP Server
          </button>
        </div>
      </div>

      {/* Tool List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Custom Python Tools */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <FileCode size={14} className="text-primary" />
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Custom Python Tools</h3>
          </div>
          <div className="space-y-2">
            {filteredPythonTools.map((tool) => (
              <div key={tool.filename} className="group bg-accent/50 border border-border rounded-sm p-3 hover:border-primary/30 transition-all">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-mono font-bold text-foreground truncate">{tool.filename.replace('tools/', '')}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onEditTool?.(tool.filename, tool.yaml)}
                      className="p-1 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button 
                      onClick={() => onDeleteTool?.(tool.filename)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground line-clamp-2 italic">Custom Python tool defined in {tool.filename}</p>
              </div>
            ))}
            {filteredPythonTools.length === 0 && (
              <div className="text-center py-4 border border-dashed border-border rounded-sm text-[10px] text-muted-foreground/40 font-mono uppercase">
                NO_CUSTOM_TOOLS_FOUND
              </div>
            )}
          </div>
        </section>

        {/* Agent Tools */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Bot size={14} className="text-purple-500" />
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Agent Modules</h3>
          </div>
          <div className="space-y-2">
            {filteredAgentTools.map((tool) => (
              <div key={tool.filename} className="bg-accent/50 border border-border rounded-sm p-3 hover:border-purple-500/30 transition-all group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-mono font-bold text-foreground truncate">{tool.filename}</span>
                  <button 
                    onClick={() => onNavigateToAgent?.(tool.filename)}
                    className="p-1 text-muted-foreground hover:text-purple-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground line-clamp-1 italic">Agent configured as a tool module</p>
              </div>
            ))}
            {filteredAgentTools.length === 0 && (
              <div className="text-center py-4 border border-dashed border-border rounded-sm text-[10px] text-muted-foreground/40 font-mono uppercase">
                NO_AGENT_MODULES_FOUND
              </div>
            )}
          </div>
        </section>

        {/* Built-in Tools */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Wrench size={14} className="text-muted-foreground" />
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Built-in Capabilities</h3>
          </div>
          <div className="space-y-2">
            {builtinTools.map((tool) => (
              <div key={tool.name} className="bg-muted/30 border border-border rounded-sm p-3 opacity-60">
                <span className="text-sm font-mono font-bold text-foreground/80">{tool.name}</span>
                <p className="text-[10px] text-muted-foreground line-clamp-2 italic">{tool.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-muted/10">
        <p className="text-[9px] text-muted-foreground/40 font-mono uppercase tracking-widest text-center">
          Project: {projectName} • {pythonTools.length + agentTools.length + builtinTools.length} Tools Available
        </p>
      </div>
    </div>
  );
}
