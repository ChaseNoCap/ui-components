import { createLogger } from '../utils/logger';

const logger = createLogger('ClaudeSessionManager');

interface Session {
  id: string;
  name: string;
  createdAt: Date;
  lastAccessed: Date;
  messages: any[];
  metadata?: {
    project?: string;
    task?: string;
    totalCost?: number;
    archived?: boolean;
    archivedAt?: string;
  };
}

interface SessionState {
  currentProgress: string;
  modifiedFiles: string[];
  nextSteps: string[];
  context: Record<string, any>;
}

class ClaudeSessionManager {
  private readonly STORAGE_KEY = 'claude_sessions';
  private readonly STATE_KEY = 'claude_session_states';
  private readonly CURRENT_SESSION_KEY = 'claude_current_session';

  /**
   * Get all sessions from local storage
   */
  async getAllSessions(): Promise<Session[]> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const sessions = JSON.parse(stored);
      // Convert date strings back to Date objects
      return sessions.map((s: any) => ({
        ...s,
        createdAt: new Date(s.createdAt),
        lastAccessed: new Date(s.lastAccessed)
      }));
    } catch (error) {
      logger.error('Failed to load sessions:', error as Error);
      return [];
    }
  }

  /**
   * Get a specific session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const sessions = await this.getAllSessions();
    return sessions.find(s => s.id === sessionId) || null;
  }

  /**
   * Save or update a session
   */
  async saveSession(session: Session): Promise<void> {
    try {
      const sessions = await this.getAllSessions();
      const index = sessions.findIndex(s => s.id === session.id);
      
      if (index >= 0) {
        sessions[index] = session;
      } else {
        sessions.unshift(session); // Add new sessions to the beginning
      }

      // Keep only the last 50 sessions
      const trimmedSessions = sessions.slice(0, 50);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmedSessions));
      logger.info('Session saved:', session.id);
    } catch (error) {
      logger.error('Failed to save session:', error as Error);
      throw error;
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessions = await this.getAllSessions();
      const filtered = sessions.filter(s => s.id !== sessionId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
      
      // Also delete associated state
      this.deleteSessionState(sessionId);
      
      logger.info('Session deleted:', sessionId);
    } catch (error) {
      logger.error('Failed to delete session:', error as Error);
      throw error;
    }
  }

  /**
   * Set the current active session
   */
  setCurrentSession(sessionId: string): void {
    localStorage.setItem(this.CURRENT_SESSION_KEY, sessionId);
  }

  /**
   * Get the current active session ID
   */
  getCurrentSessionId(): string | null {
    return localStorage.getItem(this.CURRENT_SESSION_KEY);
  }

  /**
   * Save session state for manual restoration
   */
  async saveSessionState(sessionId: string, state: SessionState): Promise<void> {
    try {
      const states = this.getAllSessionStates();
      states[sessionId] = {
        ...state,
        savedAt: new Date().toISOString()
      };
      
      localStorage.setItem(this.STATE_KEY, JSON.stringify(states));
      logger.info('Session state saved:', sessionId);
    } catch (error) {
      logger.error('Failed to save session state:', error as Error);
      throw error;
    }
  }

  /**
   * Get session state
   */
  getSessionState(sessionId: string): SessionState | null {
    const states = this.getAllSessionStates();
    return states[sessionId] || null;
  }

  /**
   * Get all session states
   */
  private getAllSessionStates(): Record<string, any> {
    try {
      const stored = localStorage.getItem(this.STATE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      logger.error('Failed to load session states:', error as Error);
      return {};
    }
  }

  /**
   * Delete session state
   */
  private deleteSessionState(sessionId: string): void {
    const states = this.getAllSessionStates();
    delete states[sessionId];
    localStorage.setItem(this.STATE_KEY, JSON.stringify(states));
  }

  /**
   * Export session data
   */
  async exportSession(sessionId: string): Promise<any> {
    const session = await this.getSession(sessionId);
    const state = this.getSessionState(sessionId);
    
    return {
      session,
      state,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  /**
   * Import session data
   */
  async importSession(data: any): Promise<string> {
    if (!data.session) {
      throw new Error('Invalid session data');
    }

    // Generate new ID to avoid conflicts
    const newSession: Session = {
      ...data.session,
      id: crypto.randomUUID(),
      name: `${data.session.name} (Imported)`,
      createdAt: new Date(data.session.createdAt),
      lastAccessed: new Date()
    };

    await this.saveSession(newSession);

    if (data.state) {
      await this.saveSessionState(newSession.id, data.state);
    }

    return newSession.id;
  }

  /**
   * Search sessions by name or content
   */
  async searchSessions(query: string): Promise<Session[]> {
    const sessions = await this.getAllSessions();
    const lowerQuery = query.toLowerCase();
    
    return sessions.filter(session => {
      // Search in session name
      if (session.name.toLowerCase().includes(lowerQuery)) return true;
      
      // Search in messages
      return session.messages.some(msg => 
        msg.content.toLowerCase().includes(lowerQuery)
      );
    });
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalSessions: number;
    totalCost: number;
    totalMessages: number;
    averageSessionLength: number;
  }> {
    const sessions = await this.getAllSessions();
    
    const stats = sessions.reduce((acc, session) => {
      acc.totalCost += session.metadata?.totalCost || 0;
      acc.totalMessages += session.messages.length;
      return acc;
    }, {
      totalSessions: sessions.length,
      totalCost: 0,
      totalMessages: 0
    });

    return {
      ...stats,
      averageSessionLength: stats.totalSessions > 0 
        ? Math.round(stats.totalMessages / stats.totalSessions) 
        : 0
    };
  }

  /**
   * Clean up old sessions
   */
  async cleanupOldSessions(daysToKeep: number = 30): Promise<number> {
    const sessions = await this.getAllSessions();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const sessionsToKeep = sessions.filter(session => 
      new Date(session.lastAccessed) > cutoffDate
    );
    
    const deletedCount = sessions.length - sessionsToKeep.length;
    
    if (deletedCount > 0) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionsToKeep));
      logger.info(`Cleaned up ${deletedCount} old sessions`);
    }
    
    return deletedCount;
  }

  /**
   * Archive a session
   */
  async archiveSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.metadata = {
      ...session.metadata,
      archived: true,
      archivedAt: new Date().toISOString()
    };

    await this.saveSession(session);
  }

  /**
   * Get archived sessions
   */
  async getArchivedSessions(): Promise<Session[]> {
    const sessions = await this.getAllSessions();
    return sessions.filter(s => s.metadata?.archived === true);
  }

  /**
   * Create a session handoff document
   */
  async createHandoffDocument(sessionId: string): Promise<string> {
    const session = await this.getSession(sessionId);
    const state = this.getSessionState(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    const handoff = `# Session Handoff Document

## Session Information
- **ID**: ${session.id}
- **Name**: ${session.name}
- **Created**: ${session.createdAt.toLocaleString()}
- **Last Accessed**: ${session.lastAccessed.toLocaleString()}
- **Total Messages**: ${session.messages.length}
- **Total Cost**: $${(session.metadata?.totalCost || 0).toFixed(4)}

## Current Progress
${state?.currentProgress || 'No progress summary available'}

## Modified Files
${state?.modifiedFiles?.map(f => `- ${f}`).join('\n') || 'No files tracked'}

## Next Steps
${state?.nextSteps?.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'No next steps defined'}

## Conversation Summary
${this.generateConversationSummary(session.messages)}

## Context
\`\`\`json
${JSON.stringify(state?.context || {}, null, 2)}
\`\`\`

---
Generated on ${new Date().toLocaleString()}
`;

    return handoff;
  }

  /**
   * Generate a summary of the conversation
   */
  private generateConversationSummary(messages: any[]): string {
    if (messages.length === 0) return 'No messages in this session';

    const userMessages = messages.filter(m => m.type === 'user').length;
    const assistantMessages = messages.filter(m => m.type === 'assistant').length;
    
    return `
- User messages: ${userMessages}
- Assistant messages: ${assistantMessages}
- First message: ${messages[0]?.content.substring(0, 100)}...
- Last message: ${messages[messages.length - 1]?.content.substring(0, 100)}...
`;
  }
}

// Export singleton instance
export const claudeSessionManager = new ClaudeSessionManager();