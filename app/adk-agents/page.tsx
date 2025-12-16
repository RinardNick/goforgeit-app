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
}

export default function ADKAgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<ADKAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgents() {
      try {
        const response = await fetch('/api/adk-agents');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch ADK agents');
        }

        setAgents(data.agents || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agents');
      } finally {
        setLoading(false);
      }
    }

    fetchAgents();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch('/api/adk-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create project');
      }

      // Redirect to the visual builder for the new project
      router.push(`/adk-agents/${projectName.trim()}/compose`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project');
      setCreating(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/adk-agents/${projectToDelete}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete project');
      }

      // Remove from local state
      setAgents((prev) => prev.filter((a) => a.id !== projectToDelete));

      // Close dialog
      setShowDeleteDialog(false);
      setProjectToDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-sandstone">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">ADK Agents</h1>
            <p className="mt-1 text-gray-500">
              Real AI agents powered by Google ADK backend
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setShowNewProjectDialog(true);
                setProjectName('');
                setCreateError(null);
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </button>
            <span className="px-3 py-1 text-sm font-medium bg-green-100 text-green-800 rounded-full">
              Live Backend
            </span>
          </div>
        </div>

        {/* New Project Dialog */}
        {showNewProjectDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div
              data-testid="new-project-dialog"
              className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Project</h2>
              <form onSubmit={handleCreateProject}>
                <div className="mb-4">
                  <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    id="projectName"
                    name="projectName"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="my_agent_project"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    pattern="[a-z][a-z0-9_]*"
                    title="Must be lowercase, start with a letter, and contain only letters, numbers, and underscores"
                    required
                    disabled={creating}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Use snake_case (e.g., my_agent_project)
                  </p>
                </div>

                {createError && (
                  <ErrorMessage message={createError} className="mb-4" />
                )}

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowNewProjectDialog(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    type="submit"
                    disabled={!projectName.trim()}
                    isLoading={creating}
                    loadingText="Creating..."
                    className="text-sm text-white bg-purple-600 hover:bg-purple-700"
                    variant="primary"
                  >
                    Create
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteDialog && projectToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div
              data-testid="delete-confirmation-dialog"
              className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Delete Project</h2>
              </div>

              <p className="text-gray-600 mb-2">
                Are you sure you want to delete{' '}
                <code className="px-2 py-0.5 bg-gray-100 rounded text-gray-900 font-medium">
                  {projectToDelete}
                </code>
                ?
              </p>
              <p className="text-sm text-gray-500 mb-6">
                This will permanently delete all agent files in this project. This action cannot be undone.
              </p>

              {deleteError && (
                <ErrorMessage message={deleteError} className="mb-4" />
              )}

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  data-testid="cancel-delete-button"
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setProjectToDelete(null);
                    setDeleteError(null);
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <LoadingButton
                  type="button"
                  onClick={handleDeleteProject}
                  isLoading={deleting}
                  loadingText="Deleting..."
                  className="text-sm text-white bg-red-600 hover:bg-red-700"
                  testId="confirm-delete-button"
                  variant="primary"
                >
                  Delete
                </LoadingButton>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="font-medium text-red-800">ADK Backend Error</h3>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                <p className="text-sm text-red-600 mt-2">
                  Make sure the ADK server is running:{' '}
                  <code className="px-1 py-0.5 bg-red-100 rounded">make dev-adk</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading ADK agents...</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && agents.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No ADK agents found</h3>
            <p className="mt-2 text-gray-500 max-w-md mx-auto">
              Create agent YAML files in <code className="px-1 py-0.5 bg-gray-100 rounded">adk-service/agents/</code> to get started.
            </p>
          </div>
        )}

        {/* Agents Grid */}
        {!loading && agents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <div
                key={agent.id}
                data-testid={`project-card-${agent.id}`}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        ADK
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{agent.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Agent ID: <code className="px-1 py-0.5 bg-gray-100 rounded">{agent.id}</code>
                    </p>
                  </div>
                  <button
                    data-testid="delete-project-button"
                    onClick={() => {
                      setProjectToDelete(agent.id);
                      setShowDeleteDialog(true);
                      setDeleteError(null);
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete project"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <div className="mt-6 flex gap-2">
                  <Link
                    href={`/adk-agents/${agent.id}/compose`}
                    className="flex-1 px-3 py-2 bg-purple-50 text-purple-700 text-center rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors font-medium text-sm"
                    title="Visual Composer"
                  >
                    Compose
                  </Link>
                  <Link
                    href={`/adk-agents/${agent.id}/edit`}
                    className="flex-1 px-3 py-2 bg-white text-gray-700 text-center rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors font-medium text-sm"
                    title="YAML Editor"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/adk-agents/${agent.id}/chat`}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                    title="Test Agent"
                  >
                    Chat
                  </Link>
                  <Link
                    href={`/adk-agents/${agent.id}/evaluations`}
                    data-testid="evaluations-link"
                    className="flex-1 px-3 py-2 bg-amber-50 text-amber-700 text-center rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors font-medium text-sm"
                    title="Agent Evaluations"
                  >
                    Evals
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-medium text-blue-900 mb-2">About ADK Agents</h3>
          <p className="text-sm text-blue-700 mb-4">
            These agents are powered by the Google ADK backend running on port 8000.
            They execute real LLM calls through the Gemini API, unlike the mock/test agents.
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 text-blue-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Real LLM execution
            </div>
            <div className="flex items-center gap-2 text-blue-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Session persistence
            </div>
            <div className="flex items-center gap-2 text-blue-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Multi-agent support
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
