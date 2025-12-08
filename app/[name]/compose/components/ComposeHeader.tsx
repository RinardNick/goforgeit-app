/**
 * ComposeHeader Component
 *
 * Header for the ADK Agent Composer page, includes:
 * - Back button and title
 * - View mode toggle (Visual/Split/YAML)
 * - Action buttons (AI Assistant, Test Agent, Discard, Save)
 * - Status indicators (unsaved changes, save success, errors)
 */

import Link from 'next/link';
import { LoadingButton } from '@/components/ui/LoadingButton';

interface ComposeHeaderProps {
  displayName: string;
  filesCount: number;
  viewMode: 'visual' | 'yaml' | 'split';
  onViewModeChange: (mode: 'visual' | 'yaml' | 'split') => void;
  showAIAssistant: boolean;
  onAIAssistantToggle: () => void;
  agentName: string;
  hasChanges: boolean;
  onDiscard: () => void;
  onSave: () => void;
  saving: boolean;
  saveSuccess: boolean;
  error: string | null;
  onErrorDismiss: () => void;
  onBack: () => void;
}

export function ComposeHeader({
  displayName,
  filesCount,
  viewMode,
  onViewModeChange,
  showAIAssistant,
  onAIAssistantToggle,
  agentName,
  hasChanges,
  onDiscard,
  onSave,
  saving,
  saveSuccess,
  error,
  onErrorDismiss,
  onBack,
}: ComposeHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-full flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                Visual Composer
              </span>
            </div>
            {filesCount > 1 && (
              <p className="text-sm text-gray-500">{filesCount} agent files</p>
            )}
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange('visual')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'visual' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Visual
            </button>
            <button
              onClick={() => onViewModeChange('split')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'split' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Split
            </button>
            <button
              onClick={() => onViewModeChange('yaml')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'yaml' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              YAML
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            data-testid="ai-assistant-toggle"
            onClick={onAIAssistantToggle}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              showAIAssistant
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI Assistant
          </button>

          <Link
            href={`/${agentName}/chat`}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Test Agent
          </Link>

          {hasChanges && (
            <button
              onClick={onDiscard}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Discard
            </button>
          )}

          <LoadingButton
            onClick={onSave}
            disabled={!hasChanges}
            isLoading={saving}
            loadingText="Saving..."
            className="text-sm"
            testId="save-button"
            variant="primary"
          >
            Save
          </LoadingButton>
        </div>
      </div>

      {/* Status indicators */}
      {hasChanges && (
        <div className="mt-2 flex items-center gap-2 text-sm text-amber-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
          </svg>
          Unsaved changes
        </div>
      )}
      {saveSuccess && (
        <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Saved successfully
        </div>
      )}
      {error && (
        <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
          </svg>
          {error}
          <button onClick={onErrorDismiss} className="underline">Dismiss</button>
        </div>
      )}
    </div>
  );
}
