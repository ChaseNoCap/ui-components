import React, { useState, useRef, useEffect } from 'react';
import { 
  Terminal, Send, Loader2, Copy, Trash2, History, ChevronRight, 
  Download, GitBranch, FileText, Archive, Share2, BarChart3,
  Zap, Users, DollarSign, Brain, Settings, FolderOpen, Tag,
  Sparkles, AlertCircle
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useToastContext } from '../Toast';
import { claudeSessionManager } from '../../services/claudeSessionManager';
import { claudeServiceGraphQL } from '../../services/claudeServiceGraphQL';
import { format } from 'date-fns';
import { useMutation, useQuery, useLazyQuery, useSubscription } from '@apollo/client';
import { GET_SESSION } from '../../graphql/claude-operations';
import {
  FORK_SESSION,
  CREATE_SESSION_TEMPLATE,
  CREATE_SESSION_FROM_TEMPLATE,
  GET_SESSION_TEMPLATES,
  BATCH_SESSION_OPERATION,
  GET_SESSION_ANALYTICS,
  ARCHIVE_SESSION,
  SHARE_SESSION
} from '../../graphql/claude-session-management';
import { SessionAnalytics } from './SessionAnalytics';
import { TemplatesPanel } from './TemplatesPanel';
import { ResumptionCard } from './ResumptionCard';
import { GET_RESUMABLE_SESSIONS } from '../../graphql/claude-session-management';
import {
  GET_PREWARM_STATUS,
  CLAIM_PREWARMED_SESSION,
  PREWARM_STATUS_SUBSCRIPTION
} from '../../graphql/claude-prewarm';

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
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  // GraphQL Mutations
  const [forkSession] = useMutation(FORK_SESSION);
  const [createTemplate] = useMutation(CREATE_SESSION_TEMPLATE);
  const [createFromTemplate] = useMutation(CREATE_SESSION_FROM_TEMPLATE);
  const [batchOperation] = useMutation(BATCH_SESSION_OPERATION);
  const [archiveSessionMutation] = useMutation(ARCHIVE_SESSION);
  const [shareSessionMutation] = useMutation(SHARE_SESSION);
  const [claimPreWarmedSession] = useMutation(CLAIM_PREWARMED_SESSION);

  // GraphQL Queries
  const [getSessionDetails] = useLazyQuery(GET_SESSION);
  const { data: templatesData, loading: templatesLoading } = useQuery(GET_SESSION_TEMPLATES, {
    skip: !showTemplates
  });
  const { data: analyticsData, loading: analyticsLoading } = useQuery(GET_SESSION_ANALYTICS, {
    variables: { sessionId: currentSession?.id },
    skip: !currentSession?.id || !showAnalytics
  });
  const { data: resumableData, loading: resumableLoading } = useQuery(GET_RESUMABLE_SESSIONS, {
    variables: { limit: 3 },
    skip: currentSession !== null
  });
  
  // Subscribe to pre-warm status updates
  const { data: preWarmData } = useSubscription(PREWARM_STATUS_SUBSCRIPTION);
  const preWarmStatus = preWarmData?.preWarmStatus;

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
    
    // Check for sessionId in URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('sessionId');
    console.log('URL sessionId:', sessionId);
    if (sessionId) {
      // Load the specific session after sessions are loaded
      // Increased delay to ensure GraphQL client is ready
      setTimeout(() => {
        console.log('Loading session from URL param after delay...');
        loadSession(sessionId);
      }, 1000);
    }
    
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
    // Clear current session to force server to create a new one
    setCurrentSession(null);
    setMessages([]);
    // Don't clear pre-warmed session - it can be reused
    showSuccess('New session created', name || 'New Session');
    
    // The actual session will be created on the first message
  };

  const loadSession = async (sessionId: string) => {
    console.log('Loading session:', sessionId);
    try {
      // First try to load from server (for forked sessions)
      console.log('Fetching session from server...');
      const { data: serverData, error: queryError } = await getSessionDetails({
        variables: { id: sessionId },
        fetchPolicy: 'network-only' // Force network request
      });
      
      console.log('Server response:', serverData);
      console.log('Query error:', queryError);
      
      if (serverData?.session) {
        const serverSession = serverData.session;
        
        // Convert server session to local format
        const session: Session = {
          id: serverSession.id,
          name: serverSession.metadata?.name || `Session ${new Date(serverSession.createdAt).toLocaleTimeString()}`,
          createdAt: new Date(serverSession.createdAt),
          lastAccessed: new Date(serverSession.lastActivity),
          messages: []
        };
        
        // Convert history to messages
        console.log('Server session history:', serverSession.history);
        if (serverSession.history && serverSession.history.length > 0) {
          const messages: ConsoleMessage[] = [];
          serverSession.history.forEach((entry: any) => {
            if (entry.prompt) {
              messages.push({
                id: crypto.randomUUID(),
                type: 'user',
                content: entry.prompt,
                timestamp: new Date(entry.timestamp)
              });
            }
            if (entry.response) {
              messages.push({
                id: crypto.randomUUID(),
                type: 'assistant',
                content: entry.response,
                timestamp: new Date(entry.timestamp),
                metadata: {
                  duration: entry.executionTime,
                  sessionId: serverSession.id
                }
              });
            }
          });
          setMessages(messages);
        } else {
          setMessages([]);
        }
        
        setCurrentSession(session);
        showInfo('Session loaded', session.name);
        
        // Save to local storage for future access
        await claudeSessionManager.saveSession(session);
        await loadSessions(); // Refresh session list
      } else {
        console.log('No session found on server, checking local storage...');
        // Fallback to local storage
        const session = await claudeSessionManager.getSession(sessionId);
        if (session) {
          console.log('Found session in local storage:', session);
          setCurrentSession(session);
          setMessages(session.messages);
          showInfo('Session loaded', session.name);
        } else {
          console.log('Session not found in local storage either');
          showError('Session not found', `Session ${sessionId} does not exist`);
        }
      }
    } catch (error) {
      console.error('Failed to load session from server, trying local:', error);
      
      // Fallback to local storage
      try {
        const session = await claudeSessionManager.getSession(sessionId);
        if (session) {
          setCurrentSession(session);
          setMessages(session.messages);
          showInfo('Session loaded', session.name);
        }
      } catch (localError) {
        showError('Failed to load session', localError instanceof Error ? localError.message : 'Unknown error');
      }
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

      // Determine which session ID to use
      let sessionIdToUse: string | null = null;
      
      if (currentSession) {
        // Use existing session
        sessionIdToUse = currentSession.id;
      } else if (preWarmStatus?.status === 'READY' && preWarmStatus?.sessionId) {
        // Try to claim the pre-warmed session
        try {
          const { data } = await claimPreWarmedSession();
          if (data?.claimPreWarmedSession?.success && data.claimPreWarmedSession.sessionId) {
            sessionIdToUse = data.claimPreWarmedSession.sessionId;
            console.log('Claimed pre-warmed session:', sessionIdToUse);
          }
        } catch (error) {
          console.error('Failed to claim pre-warmed session:', error);
        }
      }
      // If neither exists, pass null and let the server create a new session

      // Call Claude via GraphQL
      console.log('Calling Claude via GraphQL with:', {
        sessionId: sessionIdToUse,
        prompt: input.trim(),
        currentSessionId: currentSession?.id,
        messageCount: messages.length,
        lastMessage: messages[messages.length - 1]?.content
      });
      // Use the parent directory of meta-gothic-framework as the working directory
      // This ensures Claude can access all repositories when asked about git changes
      const workingDirectory = '/Users/josh/Documents';
      
      const result = await claudeServiceGraphQL.executeCommand(
        sessionIdToUse,
        input.trim(),
        workingDirectory
      );
      console.log('Claude command result:', result);

      // Remove processing message
      setMessages(prev => prev.filter(msg => msg.id !== processingMessage.id));

      if (result.success) {
        // Always update the session ID from the server
        if (result.sessionId) {
          if (!currentSession || currentSession.id !== result.sessionId) {
            const newSession: Session = {
              id: result.sessionId,
              name: currentSession?.name || `Session ${new Date().toLocaleTimeString()}`,
              createdAt: currentSession?.createdAt || new Date(),
              lastAccessed: new Date(),
              messages: currentSession?.messages || []
            };
            setCurrentSession(newSession);
            
            // Update or add the session in the list
            setSessions(prev => {
              const existing = prev.findIndex(s => s.id === result.sessionId);
              if (existing >= 0) {
                return prev.map((s, i) => i === existing ? newSession : s);
              } else {
                return [...prev, newSession];
              }
            });
          }
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

  // New session management functions
  const handleForkSession = async (messageIndex?: number) => {
    if (!currentSession) {
      showError('No session to fork', 'Please start a conversation first');
      return;
    }

    // Check if session has messages (indicating it exists on server)
    if (messages.length === 0) {
      showError('Cannot fork empty session', 'Please send at least one message before forking');
      return;
    }

    // If no messageIndex provided, find the last assistant message
    let forkIndex = messageIndex;
    if (forkIndex === undefined) {
      // Find the last assistant message (has a response)
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].type === 'assistant') {
          forkIndex = i;
          break;
        }
      }
      // If no assistant messages, use the last message
      if (forkIndex === undefined) {
        forkIndex = messages.length - 1;
      }
    }

    // Convert UI message index to server history index
    // Server stores each exchange (user prompt + assistant response) as one history entry
    // UI shows them as separate messages
    // So we need to count how many complete exchanges happened up to this point
    let serverHistoryIndex = Math.floor(forkIndex / 2);
    
    // If forking from an assistant message, that's the completion of an exchange
    // If forking from a user message, we want the previous complete exchange
    if (messages[forkIndex]?.type === 'user' && serverHistoryIndex > 0) {
      serverHistoryIndex--;
    }

    try {
      console.log('Forking session:', currentSession.id, 'at UI index:', forkIndex, 'server index:', serverHistoryIndex);
      console.log('Current messages:', messages.length);
      console.log('Fork message type:', messages[forkIndex]?.type);
      const { data } = await forkSession({
        variables: {
          input: {
            sessionId: currentSession.id,
            messageIndex: serverHistoryIndex,
            name: `Fork of ${currentSession.name}`,
            includeHistory: true
          }
        }
      });

      console.log('Fork mutation response:', data);

      if (data?.forkSession) {
        const forkName = data.forkSession.session.metadata?.name || `Fork of ${currentSession.name}`;
        const forkedSessionId = data.forkSession.session.id;
        showSuccess('Session forked', `Created "${forkName}" at message ${data.forkSession.forkMetadata.forkPoint}`);
        await loadSessions();
        
        // Small delay to ensure the session is fully initialized on the server
        setTimeout(() => {
          // Open the forked session in a new browser tab
          const currentUrl = window.location.href;
          const baseUrl = currentUrl.split('?')[0];
          const newUrl = `${baseUrl}?sessionId=${forkedSessionId}`;
          console.log('Opening forked session in new tab:', newUrl);
          window.open(newUrl, '_blank');
        }, 500);
        
        // Optionally also load it in the current tab
        // loadSession(data.forkSession.session.id);
      }
    } catch (error) {
      showError('Failed to fork session', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleCreateTemplate = async () => {
    if (!currentSession) return;

    const templateName = prompt('Template name:');
    if (!templateName) return;

    const description = prompt('Template description (optional):');
    const tags = prompt('Tags (comma-separated, optional):')?.split(',').map(t => t.trim()).filter(Boolean);

    try {
      const { data } = await createTemplate({
        variables: {
          input: {
            sessionId: currentSession.id,
            name: templateName,
            description,
            tags,
            includeHistory: false
          }
        }
      });

      if (data?.createSessionTemplate) {
        showSuccess('Template created', templateName);
      }
    } catch (error) {
      showError('Failed to create template', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleCreateFromTemplate = async (templateId: string) => {
    const sessionName = prompt('Session name:');
    
    try {
      const { data } = await createFromTemplate({
        variables: {
          templateId,
          name: sessionName
        }
      });

      if (data?.createSessionFromTemplate) {
        showSuccess('Session created from template');
        await loadSessions();
        loadSession(data.createSessionFromTemplate.id);
      }
    } catch (error) {
      showError('Failed to create session', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleBatchOperation = async (operation: string) => {
    if (selectedSessions.size === 0) {
      showError('No sessions selected');
      return;
    }

    try {
      const { data } = await batchOperation({
        variables: {
          input: {
            sessionIds: Array.from(selectedSessions),
            operation
          }
        }
      });

      if (data?.batchSessionOperation) {
        showSuccess(
          'Batch operation completed',
          `${data.batchSessionOperation.successCount}/${data.batchSessionOperation.totalProcessed} successful`
        );
        
        if (operation === 'DELETE' || operation === 'ARCHIVE') {
          await loadSessions();
          setSelectedSessions(new Set());
          setIsSelectionMode(false);
        }
      }
    } catch (error) {
      showError('Batch operation failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleArchiveSession = async (sessionId: string) => {
    try {
      const { data } = await archiveSessionMutation({
        variables: { sessionId }
      });

      if (data?.archiveSession) {
        showSuccess('Session archived', `Compressed to ${(data.archiveSession.sizeBytes / 1024).toFixed(2)}KB`);
        await loadSessions();
      }
    } catch (error) {
      showError('Failed to archive session', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleShareSession = async () => {
    if (!currentSession) return;

    const recipients = prompt('Share with (comma-separated emails):')?.split(',').map(e => e.trim());
    if (!recipients || recipients.length === 0) return;

    try {
      const { data } = await shareSessionMutation({
        variables: {
          input: {
            sessionId: currentSession.id,
            recipients,
            permission: 'VIEW',
            message: 'Shared via Claude Console'
          }
        }
      });

      if (data?.shareSession) {
        showSuccess('Session shared', `Share code: ${data.shareSession.shareCode}`);
        await navigator.clipboard.writeText(data.shareSession.shareUrl);
        showInfo('Share URL copied to clipboard');
      }
    } catch (error) {
      showError('Failed to share session', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
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
                className={`p-2 rounded transition-colors ${
                  currentSession?.id === session.id
                    ? 'bg-blue-100 dark:bg-blue-900'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                } ${isSelectionMode ? 'cursor-default' : 'cursor-pointer'}`}
                onClick={() => !isSelectionMode && loadSession(session.id)}
              >
                <div className="flex items-start space-x-2">
                  {isSelectionMode && (
                    <input
                      type="checkbox"
                      checked={selectedSessions.has(session.id)}
                      onChange={() => toggleSessionSelection(session.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                    />
                  )}
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {session.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {format(session.lastAccessed, 'MMM d, h:mm a')}
                    </div>
                    {session.metadata?.totalCost && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Cost: ${session.metadata.totalCost.toFixed(4)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Templates Panel */}
      {showTemplates && (
        <TemplatesPanel
          templatesData={templatesData}
          loading={templatesLoading}
          onClose={() => setShowTemplates(false)}
          onCreateFromTemplate={handleCreateFromTemplate}
        />
      )}

      {/* Main Console */}
      <div className="flex-1 flex flex-col relative">
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
            {currentSession && (
              <>
                <button
                  onClick={() => handleForkSession()}
                  className="p-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  title="Fork session"
                >
                  <GitBranch className="h-4 w-4" />
                </button>
                <button
                  onClick={handleCreateTemplate}
                  className="p-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  title="Create template"
                >
                  <FileText className="h-4 w-4" />
                </button>
                <button
                  onClick={handleShareSession}
                  className="p-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  title="Share session"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleArchiveSession(currentSession.id)}
                  className="p-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  title="Archive session"
                >
                  <Archive className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className="p-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              title="Session analytics"
            >
              <BarChart3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="p-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              title="Templates"
            >
              <FolderOpen className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsSelectionMode(!isSelectionMode)}
              className={`p-2 ${isSelectionMode ? 'text-blue-600' : 'text-gray-600'} hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300`}
              title="Batch operations"
            >
              <Settings className="h-4 w-4" />
            </button>
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

        {/* Batch Operations Toolbar */}
        {isSelectionMode && selectedSessions.size > 0 && (
          <div className="p-2 bg-blue-50 dark:bg-blue-900 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700 dark:text-blue-300">
                {selectedSessions.size} session{selectedSessions.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleBatchOperation('ARCHIVE')}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Archive Selected
                </button>
                <button
                  onClick={() => handleBatchOperation('EXPORT')}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Export Selected
                </button>
                <button
                  onClick={() => handleBatchOperation('DELETE')}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete Selected
                </button>
                <button
                  onClick={() => {
                    setSelectedSessions(new Set());
                    setIsSelectionMode(false);
                  }}
                  className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div 
          ref={consoleRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900"
        >
          {messages.length === 0 && (
            <>
              {/* Resumable Sessions */}
              {!currentSession && resumableData?.resumableSessions?.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                    <Sparkles className="h-4 w-4 mr-1" />
                    Resume Previous Sessions
                  </h3>
                  {resumableData.resumableSessions.map((item: any) => (
                    <ResumptionCard
                      key={item.session.id}
                      session={item.session}
                      resumptionData={item.resumptionData}
                      onResume={async (sessionId, prompt) => {
                        await loadSession(sessionId);
                        if (prompt) {
                          setInput(prompt);
                        }
                      }}
                      onDismiss={() => {
                        // In a real app, this would update user preferences
                        console.log('Dismissed resumption for', item.session.id);
                      }}
                    />
                  ))}
                </div>
              )}
              
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Start a conversation with Claude</p>
                <p className="text-sm mt-2">Type a message below to begin</p>
                {preWarmStatus?.status === 'WARMING' && (
                  <div className="mt-4 flex items-center justify-center text-xs">
                    <Zap className="h-3 w-3 mr-1 animate-pulse text-yellow-500" />
                    <span className="text-gray-600 dark:text-gray-400">Optimizing session startup...</span>
                  </div>
                )}
                {preWarmStatus?.status === 'READY' && (
                  <div className="mt-4 flex items-center justify-center text-xs">
                    <Zap className="h-3 w-3 mr-1 text-green-500" />
                    <span className="text-gray-600 dark:text-gray-400">Ready for fast response</span>
                  </div>
                )}
                {preWarmStatus?.status === 'FAILED' && (
                  <div className="mt-4 flex items-center justify-center text-xs">
                    <AlertCircle className="h-3 w-3 mr-1 text-red-500" />
                    <span className="text-gray-600 dark:text-gray-400">Session optimization unavailable</span>
                  </div>
                )}
              </div>
            </>
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
                    <div className="ml-4 flex items-center space-x-1">
                      <button
                        onClick={() => copyToClipboard(message.content)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        title="Copy"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleForkSession(messages.indexOf(message))}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        title="Fork from here"
                      >
                        <GitBranch className="h-4 w-4" />
                      </button>
                    </div>
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

        {/* Analytics Panel */}
        {showAnalytics && currentSession && (
          <SessionAnalytics
            analyticsData={analyticsData}
            loading={analyticsLoading}
            onClose={() => setShowAnalytics(false)}
          />
        )}
      </div>
    </div>
  );
};