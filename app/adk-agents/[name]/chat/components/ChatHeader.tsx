/**
 * ChatHeader Component
 *
 * Displays the page header with navigation, title, and action buttons.
 * Includes streaming toggle, debug panel toggle, and new conversation button.
 */

interface ChatHeaderProps {
  agentName: string;
  displayName: string;
  streamingEnabled: boolean;
  setStreamingEnabled: (enabled: boolean) => void;
  showDebugPanel: boolean;
  setShowDebugPanel: (show: boolean) => void;
  setPanelTab: (tab: 'sessions' | 'trace' | 'events' | 'state' | 'artifacts') => void;
  onNewConversation: () => void;
  onNavigateBack: () => void;
}

export function ChatHeader({
  displayName,
  streamingEnabled,
  setStreamingEnabled,
  showDebugPanel,
  setShowDebugPanel,
  setPanelTab,
  onNewConversation,
  onNavigateBack,
}: ChatHeaderProps) {
  return (
    <div className="max-w-full flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onNavigateBack}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
              ADK Live
            </span>
          </div>
          <p className="text-sm text-gray-500">Real-time AI Agent Chat</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Streaming Toggle */}
        <button
          onClick={() => setStreamingEnabled(!streamingEnabled)}
          data-testid="streaming-toggle"
          data-enabled={streamingEnabled ? 'true' : 'false'}
          className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${
            streamingEnabled
              ? 'bg-green-600 text-white'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300'
          }`}
          title={streamingEnabled ? 'Streaming enabled' : 'Enable streaming'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {streamingEnabled ? 'Streaming' : 'Stream'}
        </button>
        {/* Unified Debug Panel Toggle */}
        <button
          onClick={() => {
            setShowDebugPanel(!showDebugPanel);
            // If opening, default to sessions tab
            if (!showDebugPanel) {
              setPanelTab('sessions');
            }
          }}
          data-testid="debug-panel-toggle"
          className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${
            showDebugPanel
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300'
          }`}
          title={showDebugPanel ? 'Hide Debug Panel' : 'Show Debug Panel'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          Debug
        </button>
        {/* Individual Panel Toggles (for test/programmatic access - use force:true in tests) */}
        <button
          onClick={() => {
            setShowDebugPanel(true);
            setPanelTab('events');
          }}
          data-testid="events-panel-toggle"
          style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0, pointerEvents: 'none' }}
          aria-label="Toggle Events Panel"
        />
        <button
          onClick={() => {
            setShowDebugPanel(true);
            setPanelTab('trace');
          }}
          data-testid="trace-view-toggle"
          style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0, pointerEvents: 'none' }}
          aria-label="Toggle Trace View"
        />
        <button
          onClick={() => {
            setShowDebugPanel(true);
            setPanelTab('state');
          }}
          data-testid="state-viewer-toggle"
          style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0, pointerEvents: 'none' }}
          aria-label="Toggle State Viewer"
        />
        <button
          onClick={() => {
            setShowDebugPanel(true);
            setPanelTab('artifacts');
          }}
          data-testid="artifacts-panel-toggle"
          style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0, pointerEvents: 'none' }}
          aria-label="Toggle Artifacts Panel"
        />
        <button
          onClick={() => {
            setShowDebugPanel(true);
            setPanelTab('sessions');
          }}
          data-testid="sessions-panel-toggle"
          style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0, pointerEvents: 'none' }}
          aria-label="Toggle Sessions Panel"
        />
        <button
          onClick={onNewConversation}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          New Conversation
        </button>
      </div>
    </div>
  );
}
