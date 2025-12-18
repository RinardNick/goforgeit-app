/**
 * ArtifactPreviewModal Component
 *
 * Modal for previewing artifacts with support for images, text files, PDFs, and generic files.
 * Shows artifact metadata (filename, scope, version, mimeType) and provides download functionality.
 */

interface Artifact {
  filename: string;
  scope: 'session' | 'user';
  version: number;
  mimeType?: string;
  timestamp: Date;
}

interface ArtifactPreviewModalProps {
  artifact: Artifact | null;
  agentName: string;
  sessionId: string | null;
  onClose: () => void;
  onDownload: (artifact: Artifact) => void;
}

export function ArtifactPreviewModal({
  artifact,
  agentName,
  sessionId,
  onClose,
  onDownload,
}: ArtifactPreviewModalProps) {
  if (!artifact) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        data-testid="artifact-preview"
        className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-200 p-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{artifact.filename}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  artifact.scope === 'user'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {artifact.scope === 'user' ? 'User' : 'Session'}
              </span>
              <span className="text-xs text-gray-500">v{artifact.version}</span>
              {artifact.mimeType && (
                <span className="text-xs text-gray-400">{artifact.mimeType}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Close preview"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto p-6">
          {artifact.mimeType?.startsWith('image/') ? (
            // Image preview
            <div className="flex items-center justify-center">
              <img
                data-testid="artifact-image-preview"
                src={`/api/agents/${agentName}/sessions/${sessionId}/artifacts/${artifact.filename}`}
                alt={artifact.filename}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          ) : artifact.mimeType?.startsWith('text/') ||
             artifact.filename.endsWith('.txt') ||
             artifact.filename.endsWith('.json') ||
             artifact.filename.endsWith('.yaml') ||
             artifact.filename.endsWith('.yml') ||
             artifact.filename.endsWith('.md') ? (
            // Text preview
            <div
              data-testid="artifact-text-preview"
              className="bg-gray-50 rounded-lg p-4 font-mono text-sm text-gray-800 whitespace-pre-wrap"
            >
              Preview not yet available. Download functionality will be implemented in Phase 14.5.
            </div>
          ) : artifact.mimeType === 'application/pdf' ? (
            // PDF preview
            <div className="flex flex-col items-center justify-center text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-gray-600 font-medium mb-2">PDF Preview</p>
              <p className="text-xs text-gray-400">
                PDF preview will be available in a future update
              </p>
            </div>
          ) : (
            // Generic file preview
            <div className="flex flex-col items-center justify-center text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-gray-600 font-medium mb-2">File Preview</p>
              <p className="text-xs text-gray-400">
                Preview not available for this file type
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2"
            onClick={() => onDownload(artifact)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
