'use client';

import { useState, useEffect } from 'react';
import { X, Search, Box, Cpu, Loader2 } from 'lucide-react';
import { ToolType } from '@/lib/db/tool-registry';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

interface RegisterToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RegisterToolModal({ isOpen, onClose, onSuccess }: RegisterToolModalProps) {
  const [type, setType] = useState<ToolType>('CUSTOM');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For CUSTOM type: list existing agents and their tools
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [agents, setAgents] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [agentTools, setAgentTools] = useState<string[]>([]);
  const [selectedTool, setSelectedTool] = useState('');

  // For MCP type
  const [mcpUrl, setMcpUrl] = useState('');

  useEffect(() => {
    if (isOpen) fetchProjects();
  }, [isOpen]);

  async function fetchProjects() {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error('Failed to fetch projects');
    }
  }

  useEffect(() => {
    if (selectedProject) fetchAgents(selectedProject);
  }, [selectedProject]);

  async function fetchAgents(projectName: string) {
    try {
      const res = await fetch(`/api/adk-agents?project=${projectName}`);
      const data = await res.json();
      setAgents(data);
    } catch (err) {
      console.error('Failed to fetch agents');
    }
  }

  useEffect(() => {
    if (selectedAgent) fetchAgentTools(selectedAgent);
  }, [selectedAgent]);

  async function fetchAgentTools(agentName: string) {
    try {
      const res = await fetch(`/api/adk-agents/${agentName}/yaml`);
      const yaml = await res.text();
      // Simple parse for tools (regex or yaml parser)
      // For now, let's assume we have an endpoint or we parse it
      const toolsMatch = yaml.match(/tools:\s*\n(\s*-\s*.*\n)+/);
      if (toolsMatch) {
        const lines = toolsMatch[0].split('\n').slice(1);
        const tools = lines.map(l => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
        setAgentTools(tools);
      } else {
        setAgentTools([]);
      }
    } catch (err) {
      console.error('Failed to fetch agent tools');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const toolData = {
      name,
      type,
      description,
      config: type === 'CUSTOM' ? { path: selectedTool, sourceAgent: selectedAgent } : { url: mcpUrl },
      sourceProjectId: selectedProject || undefined,
    };

    try {
      const res = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to register tool');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
          <h2 className="text-xl font-heading font-bold text-foreground uppercase tracking-tight">Register New Tool</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="flex bg-muted p-1 rounded-lg">
            <button
              type="button"
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-all ${type === 'CUSTOM' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setType('CUSTOM')}
            >
              <Box className="w-4 h-4" />
              Custom Tool
            </button>
            <button
              type="button"
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-all ${type === 'MCP' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setType('MCP')}
            >
              <Cpu className="w-4 h-4" />
              MCP Server
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono font-bold text-muted-foreground uppercase mb-1.5 tracking-wider">Tool Name</label>
              <input
                type="text"
                required
                className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="e.g. Google Search Utility"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-muted-foreground uppercase mb-1.5 tracking-wider">Description</label>
              <textarea
                className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[80px]"
                placeholder="What does this tool do?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {type === 'CUSTOM' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono font-bold text-muted-foreground uppercase mb-1.5 tracking-wider">Project</label>
                    <select
                      className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-all"
                      value={selectedProject}
                      onChange={(e) => setSelectedProject(e.target.value)}
                    >
                      <option value="">Select Project</option>
                      {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono font-bold text-muted-foreground uppercase mb-1.5 tracking-wider">Agent</label>
                    <select
                      className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-all"
                      disabled={!selectedProject}
                      value={selectedAgent}
                      onChange={(e) => setSelectedAgent(e.target.value)}
                    >
                      <option value="">Select Agent</option>
                      {agents.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-mono font-bold text-muted-foreground uppercase mb-1.5 tracking-wider">Source Tool</label>
                  <select
                    required
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-all"
                    disabled={!selectedAgent}
                    value={selectedTool}
                    onChange={(e) => setSelectedTool(e.target.value)}
                  >
                    <option value="">Select Tool File</option>
                    {agentTools.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-mono font-bold text-muted-foreground uppercase mb-1.5 tracking-wider">MCP Server URL</label>
                <input
                  type="url"
                  required
                  className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="https://mcp.example.com/sse"
                  value={mcpUrl}
                  onChange={(e) => setMcpUrl(e.target.value)}
                />
              </div>
            )}
          </div>

          {error && <ErrorMessage message={error} />}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-all uppercase tracking-wide"
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              isLoading={loading}
              loadingText="Registering..."
              className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-all shadow-lg uppercase tracking-wide"
            >
              Register Tool
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
}
