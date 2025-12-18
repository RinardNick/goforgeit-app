'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/app/components/Navigation';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

interface ADKAgent {
  id: string;
  name: string;
  source: 'adk';
  projectId?: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
}

export default function ADKAgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<ADKAgent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dialogs
  const [showNewAgentDialog, setShowNewAgentDialog] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  
  // Forms
  const [newItemName, setNewItemName] = useState('');
  const [targetProjectId, setTargetProjectId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  
  // Delete
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Drag and Drop state
  const [draggedAgent, setDraggedAgent] = useState<ADKAgent | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [agentsRes, projectsRes] = await Promise.all([
        fetch('/api/agents'),
        fetch('/api/projects')
      ]);

      const agentsData = await agentsRes.json();
      const projectsData = await projectsRes.json();

      if (!agentsRes.ok) throw new Error(agentsData.error || 'Failed to fetch agents');
      if (!projectsRes.ok) throw new Error(projectsData.error || 'Failed to fetch projects');

      setAgents(agentsData.agents || []);
      setProjects(projectsData.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newItemName.trim(), projectId: targetProjectId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create agent');
      }

      router.push(`/${newItemName.trim()}/compose`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create agent');
      setCreating(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newItemName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create project');
      }

      setProjects([...projects, data.project]);
      setShowNewProjectDialog(false);
      setNewItemName('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!agentToDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/agents/${agentToDelete}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      setAgents(prev => prev.filter(a => a.id !== agentToDelete));
      setShowDeleteDialog(false);
    } catch (err) {
      setDeleteError('Failed to delete agent');
    } finally {
      setDeleting(false);
    }
  };

  const handleMoveAgent = async (agent: ADKAgent, newProjectId: string | null) => {
    try {
      // Optimistic update
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, projectId: newProjectId || undefined } : a));

      const response = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: newProjectId }),
      });

      if (!response.ok) {
        throw new Error('Failed to move agent');
      }
    } catch (err) {
      console.error(err);
      fetchData(); // Revert on error
    }
  };

  const onDragStart = (e: React.DragEvent, agent: ADKAgent) => {
    setDraggedAgent(agent);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDropProject = (e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    if (draggedAgent && draggedAgent.projectId !== projectId) {
      handleMoveAgent(draggedAgent, projectId);
    }
    setDraggedAgent(null);
  };

  const onDropUnorganized = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedAgent && draggedAgent.projectId) {
      handleMoveAgent(draggedAgent, null);
    }
    setDraggedAgent(null);
  };

  // Group agents
  const unorganizedAgents = agents.filter(a => !a.projectId);
  
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Agents & Projects</h1>
            <p className="mt-1 text-muted-foreground">Manage your AI workforce</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setNewItemName('');
                setShowNewProjectDialog(true);
              }}
              className="px-4 py-2 bg-card text-foreground border border-border rounded-lg hover:bg-accent font-medium text-sm transition-colors"
            >
              New Folder
            </button>
            <button
              onClick={() => {
                setNewItemName('');
                setTargetProjectId(null); // Default to unorganized
                setShowNewAgentDialog(true);
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Agent
            </button>
          </div>
        </div>

        {error && <ErrorMessage message={error} className="mb-6" />}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Unorganized Agents (Drop Zone) */}
            <div 
              onDragOver={onDragOver}
              onDrop={onDropUnorganized}
              className={`p-6 rounded-xl border-2 border-dashed transition-colors ${
                draggedAgent 
                  ? 'border-primary/50 bg-primary/5' 
                  : 'border-border bg-muted/30'
              }`}
            >
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Unorganized Agents
              </h2>
              
              {unorganizedAgents.length === 0 ? (
                <p className="text-muted-foreground/60 text-sm italic">No unorganized agents.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {unorganizedAgents.map(agent => (
                    <AgentCard 
                      key={agent.id} 
                      agent={agent} 
                      onDragStart={onDragStart}
                      onDelete={() => {
                        setAgentToDelete(agent.id);
                        setShowDeleteDialog(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Projects */}
            {projects.map(project => {
              const projectAgents = agents.filter(a => a.projectId === project.id);
              return (
                <div 
                  key={project.id}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDropProject(e, project.id)}
                  className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
                >
                  <div className="p-4 bg-muted/30 border-b border-border flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      {/* Fixed: Added shrink-0 to prevent squishing */}
                      <svg className="w-5 h-5 text-yellow-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                      {project.name}
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{projectAgents.length} agents</span>
                      <button
                        onClick={() => {
                          setNewItemName('');
                          setTargetProjectId(project.id);
                          setShowNewAgentDialog(true);
                        }}
                        className="p-1 text-primary hover:bg-primary/10 rounded transition-colors"
                        title="Add Agent to Folder"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    {projectAgents.length === 0 ? (
                      <p className="text-muted-foreground/60 text-sm italic text-center py-4">
                        Drag agents here to organize them.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {projectAgents.map(agent => (
                          <AgentCard 
                            key={agent.id} 
                            agent={agent} 
                            onDragStart={onDragStart}
                            onDelete={() => {
                              setAgentToDelete(agent.id);
                              setShowDeleteDialog(true);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Dialogs */}
        {showNewAgentDialog && (
          <Modal title="New Agent" onClose={() => setShowNewAgentDialog(false)}>
            <form onSubmit={handleCreateAgent}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">Agent Name (snake_case)</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary focus:border-primary"
                  placeholder="my_agent"
                  autoFocus
                />
              </div>
              {createError && <ErrorMessage message={createError} className="mb-4" />}
              <div className="flex justify-end gap-2">
                <LoadingButton type="submit" isLoading={creating} variant="primary">Create</LoadingButton>
              </div>
            </form>
          </Modal>
        )}

        {showNewProjectDialog && (
          <Modal title="New Folder" onClose={() => setShowNewProjectDialog(false)}>
            <form onSubmit={handleCreateProject}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">Folder Name</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary focus:border-primary"
                  placeholder="Marketing Agents"
                  autoFocus
                />
              </div>
              {createError && <ErrorMessage message={createError} className="mb-4" />}
              <div className="flex justify-end gap-2">
                <LoadingButton type="submit" isLoading={creating} variant="primary">Create</LoadingButton>
              </div>
            </form>
          </Modal>
        )}

        {showDeleteDialog && (
          <Modal title="Delete Agent" onClose={() => setShowDeleteDialog(false)}>
            <p className="mb-4 text-muted-foreground">Are you sure? This cannot be undone.</p>
            {deleteError && <ErrorMessage message={deleteError} className="mb-4" />}
            <div className="flex justify-end gap-2">
              <LoadingButton 
                type="button" 
                onClick={handleDeleteAgent} 
                isLoading={deleting} 
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                variant="danger"
              >
                Delete
              </LoadingButton>
            </div>
          </Modal>
        )}

      </main>
    </div>
  );
}

function AgentCard({ agent, onDragStart, onDelete }: { 
  agent: ADKAgent; 
  onDragStart: (e: React.DragEvent, agent: ADKAgent) => void;
  onDelete: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, agent)}
      className="bg-card border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-move flex flex-col justify-between group hover:border-primary/50"
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <h3 className="font-semibold text-foreground truncate font-heading" title={agent.name}>{agent.name}</h3>
      </div>
      
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Link
          href={`/${agent.id}/compose`}
          className="px-2 py-1.5 bg-primary/10 text-primary text-center rounded border border-primary/20 hover:bg-primary/20 transition-colors text-xs font-medium"
          title="Visual Composer"
        >
          Compose
        </Link>
        <Link
          href={`/${agent.id}/chat`}
          className="px-2 py-1.5 bg-accent text-foreground text-center rounded border border-border hover:bg-muted transition-colors text-xs font-medium"
          title="Test Agent"
        >
          Chat
        </Link>
        <Link
          href={`/${agent.id}/evaluations`}
          className="px-2 py-1.5 bg-accent text-foreground text-center rounded border border-border hover:bg-muted transition-colors text-xs font-medium"
          title="Evaluations"
        >
          Evals
        </Link>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-foreground font-heading">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}