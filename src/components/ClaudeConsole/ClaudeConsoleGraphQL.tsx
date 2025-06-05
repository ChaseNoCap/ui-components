import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Send, Loader2, Copy, Trash2, History, ChevronRight, Download } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useToastContext } from '../Toast';
import { claudeSessionManager } from '../../services/claudeSessionManager';
import { claudeServiceGraphQL } from '../../services/claudeServiceGraphQL';
import { format } from 'date-fns';

interface ConsoleMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'error' | 'info';
  content: string;
  timestamp: Date;
  metadata?: {
    cost?: number;
    duration?: number;
    sessionId?: string;
    turns?: number;
  };
}

interface Session {
  id: string;
  name: string;
  createdAt: Date;
  lastAccessed: Date;
  messages: ConsoleMessage[];
  metadata?: {
    project?: string;
    task?: string;
    totalCost?: number;
  };
}

export const ClaudeConsoleGraphQL: React.FC = () => {
  console.log('ClaudeConsoleGraphQL component mounting');
  
  const { theme } = useTheme();
  const { showSuccess, showError, showInfo } = useToastContext();
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showSessionPanel, setShowSessionPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
    
    // Cleanup on unmount
    return () => {
      if ((window as any).__claudeUnsubscribe) {
        (window as any).__claudeUnsubscribe();
        delete (window as any).__claudeUnsubscribe;
      }
    };
  }, []);

  const loadSessions = async () => {
    try {
      const loadedSessions = await claudeSessionManager.getAllSessions();
      setSessions(loadedSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const createNewSession = async (name?: string) => {
    const session: Session = {
      id: crypto.randomUUID(),
      name: name || `Session ${new Date().toLocaleString()}`,
      createdAt: new Date(),
      lastAccessed: new Date(),
      messages: [],
      metadata: {}
    };

    setCurrentSession(session);
    setMessages([]);
    setSessions(prev => [session, ...prev]);
    await claudeSessionManager.saveSession(session);
    showSuccess('New session created', session.name);
  };

  const loadSession = async (sessionId: string) => {
    try {
      const session = await claudeSessionManager.getSession(sessionId);
      if (session) {
        setCurrentSession(session);
        setMessages(session.messages);
        showInfo('Session loaded', session.name);
      }
    } catch (error) {
      showError('Failed to load session', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const saveCurrentSession = async () => {
    if (!currentSession) return;

    const updatedSession: Session = {
      ...currentSession,
      lastAccessed: new Date(),
      messages,
      metadata: {
        ...currentSession.metadata,
        totalCost: messages.reduce((sum, msg) => sum + (msg.metadata?.cost || 0), 0)
      }
    };

    await claudeSessionManager.saveSession(updatedSession);
    setSessions(prev => 
      prev.map(s => s.id === updatedSession.id ? updatedSession : s)
    );
  };

  const handleSubmit = async () => {
    if (!input.trim() || isProcessing) return;

    // Create or ensure session exists
    if (!currentSession) {
      await createNewSession();
    }

    const userMessage: ConsoleMessage = {
      id: crypto.randomUUID(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      // Create a system message for processing
      const processingMessage: ConsoleMessage = {
        id: crypto.randomUUID(),
        type: 'system',
        content: 'Processing...',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, processingMessage]);

      // Call Claude via GraphQL
      console.log('Calling Claude via GraphQL with:', {
        sessionId: currentSession?.id || null,
        prompt: input.trim()
      });
      const result = await claudeServiceGraphQL.executeCommand(
        currentSession?.id || null,
        input.trim()
      );
      console.log('Claude command result:', result);

      // Remove processing message
      setMessages(prev => prev.filter(msg => msg.id !== processingMessage.id));

      if (result.success) {
        // Store the new session ID if one was created
        if (result.sessionId && !currentSession) {
          const newSession: ClaudeSession = {
            id: result.sessionId,
            name: `Session ${new Date().toLocaleTimeString()}`,
            createdAt: new Date(),
            lastAccessed: new Date(),
            messages: []
          };
          setCurrentSession(newSession);
          setSessions(prev => [...prev, newSession]);
        }

        // Create a placeholder message that we'll update with the response
        const assistantMessageId = crypto.randomUUID();
        const assistantMessage: ConsoleMessage = {
          id: assistantMessageId,
          type: 'assistant',
          content: result.initialResponse || '',
          timestamp: new Date(),
          metadata: {
            sessionId: result.sessionId
          }
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        // Since we're getting the full response from the mutation now,
        // we can skip the subscription and just set processing to false
        setIsProcessing(false);
        
        // Optional: Keep subscription code commented out for future streaming support
        /*
        // Subscribe to command output for streaming responses
        // Add a small delay to ensure the session is ready
        setTimeout(() => {
          const unsubscribe = claudeServiceGraphQL.subscribeToCommandOutput(
            result.sessionId,
            (output) => {
              if (output.type === 'STDOUT' || output.type === 'FINAL') {
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: msg.content + output.content }
                    : msg
                ));
              }
              
              if (output.isFinal) {
                // Clean up subscription when done
                unsubscribe();
                setIsProcessing(false);
              }
            }
          );
          
          // Store unsubscribe function for cleanup
          (window as any).__claudeUnsubscribe = unsubscribe;
        }, 100); // Small delay to ensure session is created
        */
      } else {
        throw new Error(result.error || 'Command execution failed');
      }

      await saveCurrentSession();
    } catch (error) {
      const errorMessage: ConsoleMessage = {
        id: crypto.randomUUID(),
        type: 'error',
        content: error instanceof Error ? error.message : 'An error occurred',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      showError('Command failed', errorMessage.content);
      setIsProcessing(false);
    }
  };

  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      showSuccess('Copied to clipboard');
    } catch (error) {
      showError('Failed to copy', 'Could not copy to clipboard');
    }
  };

  const exportSession = () => {
    if (!currentSession) return;

    const exportData = {
      session: currentSession,
      messages,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claude-session-${currentSession.id}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess('Session exported');
  };

  const clearSession = () => {
    setMessages([]);
    showInfo('Console cleared');
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await claudeSessionManager.deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }
      showSuccess('Session deleted');
    } catch (error) {
      showError('Failed to delete session', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <div className="flex h-full">
      {/* Session Panel */}
      {showSessionPanel && (
        <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Sessions</h3>
            <button
              onClick={() => createNewSession()}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              New
            </button>
          </div>
          
          <div className="space-y-2">
            {sessions.map(session => (
              <div
                key={session.id}
                className={`p-2 rounded cursor-pointer transition-colors ${
                  currentSession?.id === session.id
                    ? 'bg-blue-100 dark:bg-blue-900'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => loadSession(session.id)}
              >
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {session.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {format(session.lastAccessed, 'MMM d, h:mm a')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Console */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowSessionPanel(!showSessionPanel)}
              className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <History className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Claude Console
            </h2>
            {currentSession && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {currentSession.name}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={clearSession}
              className="p-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              title="Clear console"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={exportSession}
              className="p-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              title="Export session"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={consoleRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900"
        >
          {messages.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Start a conversation with Claude</p>
              <p className="text-sm mt-2">Type a message below to begin</p>
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl p-4 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.type === 'assistant'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                    : message.type === 'error'
                    ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                    : message.type === 'system'
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 italic'
                    : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <pre className="whitespace-pre-wrap font-mono text-sm">
                      {message.content}
                    </pre>
                  </div>
                  {message.type === 'assistant' && (
                    <button
                      onClick={() => copyToClipboard(message.content)}
                      className="ml-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  )}
                </div>
                
                {message.metadata && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 text-xs opacity-75">
                    {message.metadata.cost && (
                      <span>Cost: ${message.metadata.cost.toFixed(4)} • </span>
                    )}
                    {message.metadata.duration && (
                      <span>Duration: {(message.metadata.duration / 1000).toFixed(2)}s • </span>
                    )}
                    {message.metadata.turns && (
                      <span>Turns: {message.metadata.turns}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
            className="flex space-x-4"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Type your message..."
              className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white resize-none"
              rows={3}
              disabled={isProcessing}
            />
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};