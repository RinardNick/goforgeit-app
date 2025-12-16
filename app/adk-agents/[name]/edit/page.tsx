'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navigation from '@/app/components/Navigation';
import YAMLEditor from '@/app/components/YAMLEditor';
import Link from 'next/link';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { SuccessMessage } from '@/components/ui/SuccessMessage';

export default function ADKAgentEditPage() {
  const params = useParams();
  const router = useRouter();
  const agentName = params.name as string;

  const [yaml, setYaml] = useState('');
  const [originalYaml, setOriginalYaml] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Format agent name for display
  const displayName = agentName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  // Check if there are unsaved changes
  const hasChanges = yaml !== originalYaml;

  // Load YAML on mount
  useEffect(() => {
    async function loadYaml() {
      try {
        const response = await fetch(`/api/adk-agents/${agentName}/yaml`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load agent configuration');
        }

        setYaml(data.yaml);
        setOriginalYaml(data.yaml);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
      } finally {
        setLoading(false);
      }
    }

    loadYaml();
  }, [agentName]);

  // Handle save
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch(`/api/adk-agents/${agentName}/yaml`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save configuration');
      }

      setOriginalYaml(yaml);
      setSaveSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [agentName, yaml]);

  // Handle discard changes
  const handleDiscard = useCallback(() => {
    setYaml(originalYaml);
    setSaveError(null);
  }, [originalYaml]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  return (
    <div className="min-h-screen bg-sandstone">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/adk-agents')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">Edit: {displayName}</h1>
                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                  YAML Editor
                </span>
              </div>
              <p className="text-sm text-gray-500">Configure agent behavior via YAML</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link
              href={`/adk-agents/${agentName}/chat`}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Test Agent
            </Link>

            {hasChanges && (
              <button
                onClick={handleDiscard}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Discard Changes
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                    />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Unsaved Changes Indicator */}
        {hasChanges && (
          <div className="mb-4 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            You have unsaved changes
          </div>
        )}

        {/* Success Message */}
        {saveSuccess && (
          <SuccessMessage message="Configuration saved successfully!" className="mb-4" />
        )}

        {/* Save Error Message */}
        {saveError && <ErrorMessage message={saveError} className="mb-4" />}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading configuration...</span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-red-500 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <h3 className="font-medium text-red-800">Failed to Load Configuration</h3>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                <p className="text-sm text-red-600 mt-2">
                  Make sure the ADK server is running:{' '}
                  <code className="px-1 py-0.5 bg-red-100 rounded">make dev-adk</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* YAML Editor */}
        {!loading && !error && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                    />
                  </svg>
                  <span className="font-medium text-gray-700">root_agent.yaml</span>
                </div>
                <span className="text-xs text-gray-500">
                  {yaml.split('\n').length} lines
                </span>
              </div>
            </div>

            <div className="p-4">
              <YAMLEditor value={yaml} onChange={setYaml} />
            </div>
          </div>
        )}

        {/* YAML Schema Help */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-medium text-blue-900 mb-3">ADK Agent Schema Reference</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
            <div>
              <h4 className="font-medium mb-2">Required Fields:</h4>
              <ul className="space-y-1">
                <li>
                  <code className="px-1 py-0.5 bg-blue-100 rounded">name</code> - Agent
                  identifier
                </li>
                <li>
                  <code className="px-1 py-0.5 bg-blue-100 rounded">agent_class</code> -
                  LlmAgent, SequentialAgent, etc.
                </li>
                <li>
                  <code className="px-1 py-0.5 bg-blue-100 rounded">model</code> - Gemini
                  model to use
                </li>
                <li>
                  <code className="px-1 py-0.5 bg-blue-100 rounded">instruction</code> -
                  System prompt
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Optional Fields:</h4>
              <ul className="space-y-1">
                <li>
                  <code className="px-1 py-0.5 bg-blue-100 rounded">description</code> -
                  Agent description
                </li>
                <li>
                  <code className="px-1 py-0.5 bg-blue-100 rounded">sub_agents</code> - List
                  of sub-agents
                </li>
                <li>
                  <code className="px-1 py-0.5 bg-blue-100 rounded">tools</code> - Available
                  tools
                </li>
                <li>
                  <code className="px-1 py-0.5 bg-blue-100 rounded">output_key</code> -
                  Session state key
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
