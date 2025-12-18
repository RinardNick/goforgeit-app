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
    <div className="bg-card/80 backdrop-blur-sm border-b border-border px-4 py-3 z-40 relative">
      <div className="max-w-full flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-sm transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-heading font-bold text-foreground tracking-tight uppercase">{displayName}</h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-medium text-primary bg-primary/10 border border-primary/20 rounded-full tracking-wider">
                COMPOSER
              </span>
            </div>
            {filesCount > 1 && (
              <p className="text-xs text-muted-foreground/60 font-mono mt-0.5">{filesCount} agent files</p>
            )}
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-sm p-1 border border-border">
            {(['visual', 'split', 'yaml'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onViewModeChange(mode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all duration-200 uppercase tracking-wide ${
                  viewMode === mode 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            data-testid="ai-assistant-toggle"
            onClick={onAIAssistantToggle}
            className={`px-3 py-1.5 text-xs font-medium rounded-sm border transition-all duration-200 flex items-center gap-2 uppercase tracking-wide ${
              showAIAssistant
                ? 'bg-green-500/10 border-green-500 text-green-600 dark:text-green-400 shadow-sm'
                : 'bg-transparent border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI Assistant
          </button>

          <Link
            href={`/${agentName}/chat`}
            className="px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-sm hover:bg-accent hover:text-foreground uppercase tracking-wide transition-colors"
          >
            Test Agent
          </Link>

          {hasChanges && (
            <button
              onClick={onDiscard}
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-sm hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 uppercase tracking-wide transition-colors"
            >
              Discard
            </button>
          )}

          <LoadingButton
            onClick={onSave}
            disabled={!hasChanges}
            isLoading={saving}
            loadingText="Saving..."
            className={`px-4 py-1.5 text-xs font-medium rounded-sm uppercase tracking-wide transition-all duration-300 ${
                !hasChanges 
                ? 'bg-muted text-muted-foreground/50 cursor-not-allowed' 
                : 'bg-primary text-primary-foreground hover:opacity-90 shadow-lg'
            }`}
            testId="save-button"
            variant="custom"
          >
            Save
          </LoadingButton>
        </div>
      </div>

      {/* Status indicators */}
      {hasChanges && (
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full bg-card border-b border-l border-r border-primary/30 text-primary text-[10px] px-3 py-0.5 rounded-b-sm font-mono tracking-wider shadow-sm">
          UNSAVED CHANGES
        </div>
      )}
      {saveSuccess && (
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full bg-card border-b border-l border-r border-green-500/30 text-green-600 text-[10px] px-3 py-0.5 rounded-b-sm font-mono tracking-wider shadow-sm">
          SAVED SUCCESSFULLY
        </div>
      )}
      {error && (
        <div className="mt-2 flex items-center gap-2 text-xs font-mono text-destructive bg-destructive/10 p-1 px-2 rounded-sm border border-destructive/30">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
          </svg>
          {error}
          <button onClick={onErrorDismiss} className="underline ml-2 hover:text-foreground">Dismiss</button>
        </div>
      )}
    </div>
  );
}
