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
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-sm transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight uppercase">{displayName}</h1>
            <span className="px-2 py-0.5 text-[10px] font-mono font-medium bg-forgeGreen/10 text-forgeGreen border border-forgeGreen/20 rounded-full tracking-wider">
              ADK LIVE
            </span>
          </div>
          <p className="text-sm text-muted-foreground font-light">Real-time AI Agent Chat</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Streaming Toggle */}
        <button
          onClick={() => setStreamingEnabled(!streamingEnabled)}
          data-testid="streaming-toggle"
          data-enabled={streamingEnabled ? 'true' : 'false'}
          className={`px-3 py-2 rounded-sm transition-all duration-200 flex items-center gap-2 text-xs font-mono uppercase tracking-wide ${
            streamingEnabled
              ? 'bg-forgeGreen text-white shadow-lg'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-border'
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
          className={`px-3 py-2 rounded-sm transition-all duration-200 flex items-center gap-2 text-xs font-mono uppercase tracking-wide ${
            showDebugPanel
              ? 'bg-primary text-primary-foreground shadow-lg'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-border'
          }`}
          title={showDebugPanel ? 'Hide Debug Panel' : 'Show Debug Panel'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          Debug
        </button>
        {/* ... hidden buttons ... */}
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
          className="px-4 py-2 text-xs font-mono uppercase tracking-wide text-foreground border border-border rounded-sm hover:bg-accent transition-all duration-200"
        >
          New Conversation
        </button>
      </div>
    </div>
  );
}
