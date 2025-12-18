/**
 * SessionsPanel Component
 *
 * Displays the list of chat sessions with ability to create, switch between, and delete sessions.
 * Shows session metadata (ID, timestamp, message count) and highlights the active session.
 */

interface Session {
  sessionId: string;
  createdAt: string;
  messageCount: number;
}

interface SessionsPanelProps {
  sessions: Session[];
  sessionId: string | null;
  onCreateSession: () => void;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function SessionsPanel({
  sessions,
  sessionId,
  onCreateSession,
  onSwitchSession,
  onDeleteSession,
}: SessionsPanelProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="sessions-panel">
      {/* New Session Button */}
      <div className="p-3 border-b border-border">
        <button
          onClick={onCreateSession}
          data-testid="new-session-btn"
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:opacity-90 transition-colors flex items-center justify-center gap-2 text-sm font-medium shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Session
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto" data-testid="sessions-list">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <svg className="w-12 h-12 text-muted-foreground/20 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm text-muted-foreground font-medium">No sessions yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Create a new session to start</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {sessions.map((session) => {
              const isActive = session.sessionId === sessionId;
              return (
                <div
                  key={session.sessionId}
                  data-testid="session-item"
                  data-session-id={session.sessionId}
                  data-active={isActive}
                  onClick={() => !isActive && onSwitchSession(session.sessionId)}
                  className={`p-3 rounded-sm border transition-all cursor-pointer ${
                    isActive
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code
                          data-testid="session-id-display"
                          className={`text-xs font-mono font-medium truncate ${isActive ? 'text-primary' : 'text-foreground'}`}
                        >
                          {session.sessionId.slice(0, 8)}
                        </code>
                        {isActive && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary text-primary-foreground rounded-sm uppercase tracking-wider">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span data-testid="session-timestamp" className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {new Date(session.createdAt).toLocaleTimeString()}
                        </span>
                        <span data-testid="session-message-count" className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          {session.messageCount}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.sessionId);
                      }}
                      data-testid="delete-session-btn"
                      className="p-1 text-muted-foreground/60 hover:text-destructive transition-colors"
                      title="Delete session"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
