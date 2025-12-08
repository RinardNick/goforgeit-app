/**
 * Simple in-memory session store for ADK agents
 *
 * Sessions are stored per-agent and include metadata like creation time and message count
 */

interface Session {
  sessionId: string;
  agentName: string;
  createdAt: string;
  messageCount: number;
}

class SessionStore {
  private sessions: Map<string, Session[]> = new Map();

  /**
   * Get all sessions for an agent
   */
  getSessions(agentName: string): Session[] {
    return this.sessions.get(agentName) || [];
  }

  /**
   * Get a specific session
   */
  getSession(agentName: string, sessionId: string): Session | undefined {
    const sessions = this.getSessions(agentName);
    return sessions.find(s => s.sessionId === sessionId);
  }

  /**
   * Create a new session for an agent
   */
  createSession(agentName: string): Session {
    const sessionId = this.generateSessionId();
    const session: Session = {
      sessionId,
      agentName,
      createdAt: new Date().toISOString(),
      messageCount: 0,
    };

    const sessions = this.getSessions(agentName);
    sessions.push(session);
    this.sessions.set(agentName, sessions);

    return session;
  }

  /**
   * Delete a session
   */
  deleteSession(agentName: string, sessionId: string): boolean {
    const sessions = this.getSessions(agentName);
    const index = sessions.findIndex(s => s.sessionId === sessionId);

    if (index === -1) return false;

    sessions.splice(index, 1);
    this.sessions.set(agentName, sessions);
    return true;
  }

  /**
   * Increment message count for a session
   */
  incrementMessageCount(agentName: string, sessionId: string): void {
    const session = this.getSession(agentName, sessionId);
    if (session) {
      session.messageCount++;
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Clear all sessions for an agent (useful for testing)
   */
  clearAllSessions(agentName: string): void {
    this.sessions.delete(agentName);
  }

  /**
   * Clear all sessions for all agents (useful for test cleanup)
   */
  clearAllAgentSessions(): void {
    this.sessions.clear();
  }
}

// Export a singleton instance
export const sessionStore = new SessionStore();
