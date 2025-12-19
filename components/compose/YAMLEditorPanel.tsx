/**
 * YAMLEditorPanel Component
 *
 * Panel for editing agent YAML files, includes:
 * - File tabs (for multi-file agents)
 * - Error indicators (parse errors, validation errors, circular dependencies)
 * - YAML text editor
 */

import YAMLEditor from '@/app/components/YAMLEditor';
import type { AgentFile } from '@/lib/adk/nodes';

export interface YAMLEditorPanelProps {
  viewMode: 'visual' | 'yaml' | 'split';
  files: AgentFile[];
  selectedFile: string;
  onSelectFile: (filename: string) => void;
  yamlError: string | null;
  validationError: string | null;
  circularDependencyWarning: string | null;
  currentYaml: string;
  onYamlChange: (value: string) => void;
}

export function YAMLEditorPanel({
  viewMode,
  files,
  selectedFile,
  onSelectFile,
  yamlError,
  validationError,
  circularDependencyWarning,
  currentYaml,
  onYamlChange,
}: YAMLEditorPanelProps) {
  if (viewMode !== 'yaml' && viewMode !== 'split') {
    return null;
  }

  return (
    <div className={`${viewMode === 'split' ? 'w-1/2 border-r border-white/10' : 'flex-1'} flex flex-col bg-deepBlue`} style={{ height: 'calc(100vh - 140px)', minHeight: '500px' }}>
      {/* File Tabs */}
      {files.length > 1 && (
        <div className="flex border-b border-white/10 bg-charcoal/30 overflow-x-auto">
          {files.map((file) => (
            <button
              key={file.filename}
              onClick={() => onSelectFile(file.filename)}
              className={`px-4 py-2 text-xs font-mono font-medium whitespace-nowrap transition-colors ${
                selectedFile === file.filename
                  ? 'text-primary border-b-2 border-primary bg-white/5'
                  : 'text-silver hover:text-white hover:bg-white/5 border-b-2 border-transparent'
              }`}
            >
              {file.filename}
            </button>
          ))}
        </div>
      )}

      {/* YAML Error Indicators */}
      {yamlError && (
        <div className="px-4 py-2 bg-destructive/20 border-b border-destructive/20 text-destructive text-xs font-mono flex items-center gap-2" data-testid="yaml-error">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {yamlError}
        </div>
      )}
      {validationError && (
        <div className="px-4 py-2 bg-warning/20 border-b border-warning/20 text-warning text-xs font-mono flex items-center gap-2" data-testid="yaml-validation-error">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {validationError}
        </div>
      )}
      {circularDependencyWarning && (
        <div className="px-4 py-2 bg-warning/20 border-b border-warning/20 text-warning text-xs font-mono flex items-center gap-2" data-testid="circular-dependency-warning">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {circularDependencyWarning}
        </div>
      )}

      {/* YAML Editor */}
      <div className="flex-1 overflow-auto">
        <YAMLEditor
          value={currentYaml}
          onChange={onYamlChange}
          className="h-full"
        />
      </div>
    </div>
  );
}
