import { useState, useEffect } from 'react';
import { Search, Plus, Box, Cpu, Loader2, Tag as TagIcon } from 'lucide-react';
import { Tool } from '@/lib/db/tool-registry';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

interface ToolRegistryPanelProps {
  onImport: (tool: Tool) => Promise<void>;
}

export function ToolRegistryPanel({ onImport }: ToolRegistryPanelProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState<string | null>(null);

  useEffect(() => {
    fetchTools();
  }, []);

  async function fetchTools() {
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

  const handleImport = async (tool: Tool) => {
    setImporting(tool.id);
    try {
      await onImport(tool);
    } catch (err) {
      // Error handling should be done by parent or displayed here
      console.error(err);
    } finally {
      setImporting(null);
    }
  };

  const filteredTools = tools.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.category?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search registry..."
          className="w-full bg-muted/50 border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filteredTools.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No tools found.</p>
        ) : (
          filteredTools.map(tool => (
            <div key={tool.id} className="bg-card border border-border rounded-lg p-3 flex items-start justify-between gap-3 group hover:border-primary/30 transition-all">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {tool.type === 'MCP' ? <Cpu className="w-4 h-4 text-info shrink-0" /> : <Box className="w-4 h-4 text-primary shrink-0" />}
                  <span className="font-medium text-sm truncate" title={tool.name}>{tool.name}</span>
                  {tool.category && (
                    <span className="px-1.5 py-0.5 bg-muted text-[10px] rounded text-muted-foreground uppercase tracking-wider">
                      {tool.category}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{tool.description}</p>
                {tool.type === 'MCP' && tool.config?.tools && Array.isArray(tool.config.tools) && (
                  <div className="mt-2 text-[10px] text-muted-foreground/70">
                    <span className="font-bold">{tool.config.tools.length} tools:</span>{' '}
                    {tool.config.tools.map((t: any) => t.name).slice(0, 3).join(', ')}
                    {tool.config.tools.length > 3 && ', ...'}
                  </div>
                )}
              </div>
              <LoadingButton
                size="sm"
                variant="outline"
                className="shrink-0"
                isLoading={importing === tool.id}
                onClick={() => handleImport(tool)}
              >
                Import
              </LoadingButton>
            </div>
          ))
        )}
      </div>
    </div>
  );
}