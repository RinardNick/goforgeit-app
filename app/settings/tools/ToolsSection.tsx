'use client';

import { useState, useEffect } from 'react';
import { Plus, PenLine, Trash2, Box, Cpu, Search, Tag as TagIcon } from 'lucide-react';
import { Tool } from '@/lib/db/tool-registry';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { SuccessMessage } from '@/components/ui/SuccessMessage';
import RegisterToolModal from './RegisterToolModal';

export default function ToolsSection() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  useEffect(() => {
    fetchTools();
  }, []);

  async function fetchTools() {
    setLoading(true);
    try {
      const res = await fetch('/api/tools');
      if (!res.ok) throw new Error('Failed to fetch tools');
      const data = await res.json();
      setTools(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load tool registry');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to remove this tool from the registry?')) return;
    
    try {
      const res = await fetch(`/api/tools/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete tool');
      fetchTools();
    } catch (err) {
      setError('Failed to delete tool');
    }
  }

  const filteredTools = tools.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.category?.toLowerCase().includes(search.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground uppercase tracking-tight">Tool Registry</h2>
          <p className="text-sm text-muted-foreground">Manage centralized tools and MCP servers available across all agents.</p>
        </div>
        <button
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-all shadow-lg uppercase tracking-wide"
          onClick={() => setIsRegisterModalOpen(true)}
        >
          <Plus className="w-4 h-4" />
          Add Tool
        </button>
      </div>

      {/* ... search and other UI */}
      <RegisterToolModal 
        isOpen={isRegisterModalOpen} 
        onClose={() => setIsRegisterModalOpen(false)} 
        onSuccess={fetchTools} 
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search tools by name, category, or description..."
          className="w-full bg-muted/50 border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-xl border border-border" />
          ))
        ) : filteredTools.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-muted/30 rounded-xl border border-dashed border-border">
            <Box className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground font-mono text-sm">No tools found matching your search.</p>
          </div>
        ) : (
          filteredTools.map((tool) => (
            <div
              key={tool.id}
              className="group bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all relative overflow-hidden shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${tool.type === 'MCP' ? 'bg-info/10 text-info' : 'bg-primary/10 text-primary'}`}>
                    {tool.type === 'MCP' ? <Cpu className="w-5 h-5" /> : <Box className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-foreground uppercase tracking-tight">{tool.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 bg-muted text-muted-foreground text-[10px] rounded-full font-mono uppercase tracking-wider border border-border">
                        {tool.type}
                      </span>
                      {tool.category && (
                        <span className="flex items-center gap-1 text-[10px] text-primary font-mono uppercase tracking-wider">
                          <TagIcon className="w-3 h-3" />
                          {tool.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all">
                    <PenLine className="w-4 h-4" />
                  </button>
                  <button 
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                    onClick={() => handleDelete(tool.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {tool.description || 'No description provided.'}
              </p>
              {tool.tags && Array.isArray(tool.tags) && tool.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {tool.tags.slice(0, 3).map((tag, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-muted/50 text-muted-foreground/70 text-[9px] rounded-sm font-mono lowercase">
                      #{tag}
                    </span>
                  ))}
                  {tool.tags.length > 3 && (
                    <span className="text-[9px] text-muted-foreground/50 font-mono ml-1">+{tool.tags.length - 3} more</span>
                  )}
                </div>
              )}

              {/* Discovered Tools (for MCP) */}
              {tool.type === 'MCP' && tool.config?.tools && Array.isArray(tool.config.tools) && tool.config.tools.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Available Tools ({tool.config.tools.length})
                  </p>
                  <div className="space-y-1">
                    {tool.config.tools.slice(0, 3).map((t: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground/80">
                        <span className="w-1 h-1 rounded-full bg-info/50 flex-shrink-0"></span>
                        <span className="font-mono truncate">{t.name}</span>
                      </div>
                    ))}
                    {tool.config.tools.length > 3 && (
                      <p className="text-[10px] text-muted-foreground/50 italic pl-3">
                        +{tool.config.tools.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
