'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/app/components/Navigation';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { EvalSetWithHistory } from '@/lib/adk/evaluation-types';

export default function EvaluationsPage() {
  const params = useParams();
  const router = useRouter();
  const agentName = params?.name as string;

  const [evalsets, setEvalsets] = useState<EvalSetWithHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newEvalsetName, setNewEvalsetName] = useState('');
  const [newEvalsetDescription, setNewEvalsetDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [evalsetToDelete, setEvalsetToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Import dialog state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  useEffect(() => {
    fetchEvalsets();
  }, [agentName]);

  const fetchEvalsets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/adk-agents/${agentName}/evaluations`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch evaluations');
      }

      setEvalsets(data.evalsets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load evaluations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvalset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvalsetName.trim()) return;

    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch(`/api/adk-agents/${agentName}/evaluations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newEvalsetName.trim(),
          description: newEvalsetDescription.trim() || undefined,
          testCases: [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create evaluation');
      }

      // Add new evalset to list
      setEvalsets((prev) => [...prev, data]);

      // Close dialog and reset form
      setShowCreateDialog(false);
      setNewEvalsetName('');
      setNewEvalsetDescription('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create evaluation');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteEvalset = async () => {
    if (!evalsetToDelete) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/adk-agents/${agentName}/evaluations/${evalsetToDelete}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete evaluation');
      }

      // Remove from local state
      setEvalsets((prev) => prev.filter((e) => e.eval_set_id !== evalsetToDelete));

      // Close dialog
      setShowDeleteDialog(false);
      setEvalsetToDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete evaluation');
    } finally {
      setDeleting(false);
    }
  };

  const handleImportEvalset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setImporting(true);
    setImportError(null);

    try {
      // Read file content
      const fileContent = await selectedFile.text();

      // Send to import API
      const response = await fetch(`/api/adk-agents/${agentName}/evaluations/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileContent }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import evaluation');
      }

      // Add imported evalset to list
      setEvalsets((prev) => [...prev, data.evalset]);

      // Close dialog and reset
      setShowImportDialog(false);
      setSelectedFile(null);

      // Show success message
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 3000);

      // Refresh evalsets to ensure we have the latest
      await fetchEvalsets();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import evaluation');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-sandstone" data-testid="evaluations-page">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Link href="/adk-agents" className="hover:text-gray-700">
                ADK Agents
              </Link>
              <span>/</span>
              <Link href={`/adk-agents/${agentName}/compose`} className="hover:text-gray-700">
                {agentName}
              </Link>
              <span>/</span>
              <span className="text-gray-900">Evaluations</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Evaluations</h1>
            <p className="mt-1 text-gray-500">
              Test your agent responses against expected outputs
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowImportDialog(true);
                setSelectedFile(null);
                setImportError(null);
              }}
              data-testid="import-evalset-btn"
              className="px-4 py-2 bg-card text-warning rounded-lg hover:bg-warning/10 border border-warning transition-colors font-medium text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Import
            </button>
            <button
              onClick={() => {
                setShowCreateDialog(true);
                setNewEvalsetName('');
                setNewEvalsetDescription('');
                setCreateError(null);
              }}
              data-testid="create-evalset-btn"
              className="px-4 py-2 bg-warning text-warning-foreground rounded-lg hover:opacity-90 transition-colors font-medium text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Evaluation
            </button>
          </div>
        </div>

        {/* Create Dialog */}
        {showCreateDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div
              data-testid="create-evalset-dialog"
              className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4">Create Evaluation</h2>
              <form onSubmit={handleCreateEvalset}>
                <div className="mb-4">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={newEvalsetName}
                    onChange={(e) => setNewEvalsetName(e.target.value)}
                    placeholder="Basic Response Tests"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    required
                    disabled={creating}
                  />
                </div>

                <div className="mb-4">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={newEvalsetDescription}
                    onChange={(e) => setNewEvalsetDescription(e.target.value)}
                    placeholder="Tests for basic agent responses..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                    disabled={creating}
                  />
                </div>

                {createError && (
                  <ErrorMessage message={createError} className="mb-4" />
                )}

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCreateDialog(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    type="submit"
                    disabled={!newEvalsetName.trim()}
                    isLoading={creating}
                    loadingText="Creating..."
                    className="text-sm text-white bg-amber-600 hover:bg-amber-700"
                    testId="confirm-create-evalset"
                    variant="primary"
                  >
                    Create
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Import Dialog */}
        {showImportDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div
              data-testid="import-evalset-dialog"
              className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4">Import Evaluation</h2>
              <form onSubmit={handleImportEvalset}>
                <div className="mb-4">
                  <label htmlFor="import-file" className="block text-sm font-medium text-gray-700 mb-2">
                    Upload .test.json File
                  </label>
                  <input
                    type="file"
                    id="import-file"
                    data-testid="import-file-input"
                    accept=".json,.test.json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedFile(file);
                        setImportError(null);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                    disabled={importing}
                  />
                  {selectedFile && (
                    <p className="mt-2 text-sm text-gray-600">
                      Selected: {selectedFile.name}
                    </p>
                  )}
                </div>

                {importError && (
                  <ErrorMessage message={importError} className="mb-4" />
                )}

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportDialog(false);
                      setSelectedFile(null);
                      setImportError(null);
                    }}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                    disabled={importing}
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    type="submit"
                    disabled={!selectedFile}
                    isLoading={importing}
                    loadingText="Importing..."
                    className="text-sm text-white bg-amber-600 hover:bg-amber-700"
                    testId="confirm-import-btn"
                    variant="primary"
                  >
                    Import
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteDialog && evalsetToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Delete Evaluation</h2>
              </div>

              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this evaluation? This will remove all test cases and run history.
              </p>

              {deleteError && (
                <ErrorMessage message={deleteError} className="mb-4" />
              )}

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setEvalsetToDelete(null);
                    setDeleteError(null);
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <LoadingButton
                  type="button"
                  onClick={handleDeleteEvalset}
                  isLoading={deleting}
                  loadingText="Deleting..."
                  className="text-sm text-white bg-destructive hover:opacity-90"
                  testId="confirm-delete-evalset"
                  variant="primary"
                >
                  Delete
                </LoadingButton>
              </div>
            </div>
          </div>
        )}

        {/* Success Notification */}
        {importSuccess && (
          <div className="mb-6 p-4 bg-success/10 border border-success/20 rounded-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-success font-medium">Imported successfully</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <ErrorMessage message={error} className="mb-6" />
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
            <span className="ml-3 text-gray-600">Loading evaluations...</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && evalsets.length === 0 && (
          <div
            data-testid="evaluations-empty-state"
            className="text-center py-12 bg-white rounded-xl border border-gray-200"
          >
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No evaluations yet</h3>
            <p className="mt-2 text-gray-500 max-w-md mx-auto">
              Create your first evaluation to test your agent&apos;s responses against expected outputs.
            </p>
            <button
              onClick={() => {
                setShowCreateDialog(true);
                setNewEvalsetName('');
                setNewEvalsetDescription('');
                setCreateError(null);
              }}
              className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium text-sm"
            >
              Create First Evaluation
            </button>
          </div>
        )}

        {/* Evalsets Grid */}
        {!loading && evalsets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {evalsets.map((evalset) => {
              const lastRunPassRate = evalset.runs && evalset.runs.length > 0
                ? evalset.runs[evalset.runs.length - 1].overall_pass_rate
                : undefined;

              return (
                <div
                  key={evalset.eval_set_id}
                  data-testid="evalset-card"
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-warning to-primary flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                        </div>
                        {lastRunPassRate !== undefined && (
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            lastRunPassRate === 100
                              ? 'bg-success/20 text-success'
                              : lastRunPassRate >= 50
                              ? 'bg-warning/20 text-warning'
                              : 'bg-destructive/20 text-destructive'
                          }`}>
                            {lastRunPassRate}% pass
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">{evalset.name}</h3>
                      {evalset.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{evalset.description}</p>
                      )}
                      <p className="text-sm text-gray-500 mt-2" data-testid="evalset-test-count">
                        {evalset.eval_cases.length} conversation{evalset.eval_cases.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <button
                      data-testid="delete-evalset-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEvalsetToDelete(evalset.eval_set_id);
                        setShowDeleteDialog(true);
                        setDeleteError(null);
                      }}
                      className="p-2 text-gray-400 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title="Delete evaluation"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-4">
                    <Link
                      href={`/adk-agents/${agentName}/evaluations/${evalset.eval_set_id}`}
                      className="block w-full px-3 py-2 bg-warning/10 text-warning text-center rounded-lg border border-warning/20 hover:bg-warning/20 transition-colors font-medium text-sm"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
