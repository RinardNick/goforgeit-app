/**
 * ArtifactsPanel Component
 *
 * Displays the list of artifacts created by agents with ability to upload, preview, and download.
 * Shows artifact metadata (filename, scope, version, mimeType).
 */

interface Artifact {
  filename: string;
  scope: 'session' | 'user';
  version: number;
  mimeType?: string;
  timestamp: Date;
}

interface ArtifactsPanelProps {
  artifacts: Artifact[];
  onUploadClick: () => void;
  onArtifactClick: (artifact: Artifact) => void;
  onDownloadArtifact: (artifact: Artifact) => void;
}

export function ArtifactsPanel({
  artifacts,
  onUploadClick,
  onArtifactClick,
  onDownloadArtifact,
}: ArtifactsPanelProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="artifacts-panel">
      {/* Upload Button */}
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={onUploadClick}
          className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Upload Artifact
        </button>
      </div>

      {/* Artifacts List */}
      <div className="flex-1 overflow-y-auto">
        {artifacts.length === 0 ? (
          <div data-testid="artifacts-empty-state" className="flex flex-col items-center justify-center h-full text-center p-4">
            <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-gray-500 font-medium">No artifacts yet</p>
            <p className="text-xs text-gray-400 mt-1">Artifacts created by agents will appear here</p>
          </div>
        ) : (
          <div data-testid="artifacts-list" className="p-3 space-y-2">
            {artifacts.map((artifact) => (
              <div
                key={`${artifact.filename}-${artifact.version}`}
                data-testid={`artifact-item-${artifact.filename}`}
                className="p-3 bg-white border border-gray-200 rounded-lg hover:border-amber-300 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => onArtifactClick(artifact)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {artifact.filename}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`px-1.5 py-0.5 rounded font-medium ${
                          artifact.scope === 'user'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {artifact.scope}
                      </span>
                      <span className="text-gray-500">v{artifact.version}</span>
                      {artifact.mimeType && (
                        <span className="text-gray-400">{artifact.mimeType}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownloadArtifact(artifact);
                    }}
                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                    title="Download artifact"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
