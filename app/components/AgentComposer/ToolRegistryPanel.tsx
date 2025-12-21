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
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-primary/20">
        {/* Custom Python Tools */}
        <section>
          <div className="flex items-center justify-between mb-3 border-b border-primary/10 pb-1">
            <div className="flex items-center gap-2">
              <FileCode size={14} className="text-primary" />
              <h3 className="text-[10px] font-bold text-primary/80 uppercase tracking-widest font-mono">Custom_Python_Tools</h3>
            </div>
            <span className="text-[9px] font-mono text-muted-foreground/40 px-1.5 py-0.5 bg-muted rounded-sm">
              {pythonTools.length}
            </span>
          </div>
          <div className="space-y-2">
            {filteredPythonTools.map((tool) => (
              <div key={tool.filename} className="group bg-accent/30 border border-border/50 rounded-sm p-3 hover:border-primary/40 hover:bg-primary/5 transition-all duration-300">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-mono font-bold text-foreground truncate group-hover:text-primary transition-colors">
                    {tool.filename.replace('tools/', '')}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                    <button 
                      onClick={() => onEditTool?.(tool.filename, tool.yaml)}
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-sm transition-all"
                      title="Edit Tool"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button 
                      onClick={() => onDeleteTool?.(tool.filename)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-sm transition-all"
                      title="Delete Tool"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                  <p className="text-[10px] text-muted-foreground line-clamp-1 italic font-mono">
                    IMPLEMENTATION: {tool.filename}
                  </p>
                </div>
              </div>
            ))}
            {filteredPythonTools.length === 0 && (
              <div className="text-center py-8 border border-dashed border-border/30 rounded-sm bg-muted/5">
                <p className="text-[10px] text-muted-foreground/30 font-mono uppercase tracking-widest">
                  NO_CUSTOM_TOOLS_REGISTERED
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Agent Tools */}
        <section>
          <div className="flex items-center justify-between mb-3 border-b border-purple-500/10 pb-1">
            <div className="flex items-center gap-2">
              <Bot size={14} className="text-purple-500" />
              <h3 className="text-[10px] font-bold text-purple-500/80 uppercase tracking-widest font-mono">Agent_Modules</h3>
            </div>
            <span className="text-[9px] font-mono text-muted-foreground/40 px-1.5 py-0.5 bg-muted rounded-sm">
              {agentTools.length}
            </span>
          </div>
          <div className="space-y-2">
            {filteredAgentTools.map((tool) => (
              <div key={tool.filename} className="group bg-accent/30 border border-border/50 rounded-sm p-3 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all duration-300">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-mono font-bold text-foreground truncate group-hover:text-purple-400 transition-colors">
                    {tool.filename}
                  </span>
                  <button 
                    onClick={() => onNavigateToAgent?.(tool.filename)}
                    className="p-1.5 text-muted-foreground hover:text-purple-500 hover:bg-purple-500/10 rounded-sm transition-all opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0"
                    title="Go to Agent"
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500/40" />
                  <p className="text-[10px] text-muted-foreground line-clamp-1 italic font-mono uppercase">
                    TYPE: ADK_AGENT_YAML
                  </p>
                </div>
              </div>
            ))}
            {filteredAgentTools.length === 0 && (
              <div className="text-center py-8 border border-dashed border-border/30 rounded-sm bg-muted/5">
                <p className="text-[10px] text-muted-foreground/30 font-mono uppercase tracking-widest">
                  NO_AGENT_MODULES_DETECTED
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Built-in Tools */}
        <section>
          <div className="flex items-center justify-between mb-3 border-b border-muted-foreground/10 pb-1">
            <div className="flex items-center gap-2">
              <Wrench size={14} className="text-muted-foreground" />
              <h3 className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest font-mono">System_Capabilities</h3>
            </div>
            <span className="text-[9px] font-mono text-muted-foreground/40 px-1.5 py-0.5 bg-muted rounded-sm">
              {builtinTools.length}
            </span>
          </div>
          <div className="space-y-2 opacity-70">
            {builtinTools.map((tool) => (
              <div key={tool.name} className="bg-muted/20 border border-border/30 rounded-sm p-3 grayscale hover:grayscale-0 transition-all duration-500">
                <span className="text-sm font-mono font-bold text-foreground/60">{tool.name}</span>
                <p className="text-[10px] text-muted-foreground/60 line-clamp-2 italic font-mono uppercase mt-1 leading-relaxed">
                  {tool.description}
                </p>
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
