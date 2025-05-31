import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Send, Loader2, Copy, Trash2, History, ChevronRight, Download } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useToastContext } from '../Toast';
import { claudeSessionManager } from '../../services/claudeSessionManager';
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

export const ClaudeConsole: React.FC = () => {
  console.log('ClaudeConsole component mounting');
  
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

      // Call Claude API
      console.log('Calling Claude API with prompt:', input.trim());
      const response = await fetch('http://localhost:3005/api/claude/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: input.trim(),
          sessionId: currentSession?.id,
          outputFormat: 'stream-json',
          options: {
            print: true,
            continue: messages.length > 0
          }
        }),
      });

      console.log('Response status:', response.status, response.statusText);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Claude API error: ${response.statusText} - ${errorText}`);
      }

      // Handle SSE streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Remove processing message
      setMessages(prev => prev.filter(msg => msg.id !== processingMessage.id));

      while (reader) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('Stream reading complete');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        console.log('Received chunk:', chunk);
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          console.log('Processing line:', line);
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6); // Remove 'data: ' prefix
              if (jsonStr.trim()) {
                const data = JSON.parse(jsonStr);
                console.log('Parsed data:', data);
                handleStreamData(data);
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e, 'Line was:', line);
            }
          }
        }
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
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStreamData = (data: any) => {
    if (data.type === 'result') {
      const assistantMessage: ConsoleMessage = {
        id: crypto.randomUUID(),
        type: 'assistant',
        content: data.result || data.content || '',
        timestamp: new Date(),
        metadata: {
          cost: data.cost_usd,
          duration: data.duration_ms,
          sessionId: data.session_id,
          turns: data.num_turns
        }
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Update current session ID if provided
      if (data.session_id && currentSession) {
        setCurrentSession(prev => prev ? { ...prev, id: data.session_id } : null);
      }
    } else if (data.type === 'message') {
      // Handle streaming messages
      const streamMessage: ConsoleMessage = {
        id: crypto.randomUUID(),
        type: data.role === 'user' ? 'user' : 'assistant',
        content: data.content,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, streamMessage]);
    } else if (data.type === 'error') {
      const errorMessage: ConsoleMessage = {
        id: crypto.randomUUID(),
        type: 'error',
        content: data.content,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } else if (data.type === 'complete') {
      // Session completed, update session ID if needed
      if (data.session_id && currentSession) {
        setCurrentSession(prev => prev ? { ...prev, id: data.session_id } : null);
      }
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

  const clearConsole = () => {
    setMessages([]);
    if (currentSession) {
      saveCurrentSession();
    }
  };

  return (
    <div className={`flex h-[calc(100vh-12rem)] rounded-lg border overflow-hidden ${
      theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'
    }`}>
      {/* Session Panel */}
      {showSessionPanel && (
        <div className={`w-80 border-r flex flex-col ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="p-4 border-b">
            <h3 className="font-semibold mb-3">Sessions</h3>
            <button
              onClick={() => createNewSession()}
              className={`w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              New Session
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {sessions.map(session => (
              <button
                key={session.id}
                onClick={() => loadSession(session.id)}
                className={`w-full text-left p-3 rounded-md mb-2 transition-colors ${
                  currentSession?.id === session.id
                    ? theme === 'dark'
                      ? 'bg-gray-700'
                      : 'bg-gray-100'
                    : theme === 'dark'
                      ? 'hover:bg-gray-700'
                      : 'hover:bg-gray-50'
                }`}
              >
                <div className="font-medium text-sm">{session.name}</div>
                <div className={`text-xs mt-1 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {format(new Date(session.lastAccessed), 'MMM d, h:mm a')}
                </div>
                {session.metadata?.totalCost && (
                  <div className="text-xs mt-1 text-green-500">
                    Cost: ${session.metadata.totalCost.toFixed(4)}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Console */}
      <div className="flex-1 flex flex-col">
        {/* Console Header */}
        <div className={`px-4 py-3 border-b flex items-center justify-between ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowSessionPanel(!showSessionPanel)}
              className={`p-2 rounded-md transition-colors ${
                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
            >
              <History className="h-4 w-4" />
            </button>
            <Terminal className="h-5 w-5" />
            <span className="font-semibold">Claude Console</span>
            {currentSession && (
              <span className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                - {currentSession.name}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={exportSession}
              disabled={!currentSession}
              className={`p-2 rounded-md transition-colors ${
                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              } disabled:opacity-50`}
              title="Export session"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={clearConsole}
              className={`p-2 rounded-md transition-colors ${
                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
              title="Clear console"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Console Output */}
        <div
          ref={consoleRef}
          className={`flex-1 overflow-y-auto p-4 font-mono text-sm ${
            theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
          }`}
        >
          {messages.length === 0 && (
            <div className={`text-center py-8 ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`}>
              <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Claude Console ready. Type a command to begin.</p>
              <p className="text-xs mt-2">Sessions are automatically saved.</p>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className="mb-4">
              <div className="flex items-start space-x-2">
                <ChevronRight className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                  message.type === 'user' ? 'text-blue-500' :
                  message.type === 'assistant' ? 'text-green-500' :
                  message.type === 'error' ? 'text-red-500' :
                  message.type === 'system' ? 'text-yellow-500' :
                  'text-gray-500'
                }`} />
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className={`font-semibold ${
                      message.type === 'user' ? 'text-blue-500' :
                      message.type === 'assistant' ? 'text-green-500' :
                      message.type === 'error' ? 'text-red-500' :
                      message.type === 'system' ? 'text-yellow-500' :
                      'text-gray-500'
                    }`}>
                      {message.type === 'user' ? 'You' :
                       message.type === 'assistant' ? 'Claude' :
                       message.type === 'system' ? 'System' :
                       message.type === 'error' ? 'Error' : 'Info'}
                    </span>
                    <span className={`text-xs ${
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      {format(message.timestamp, 'HH:mm:ss')}
                    </span>
                    {message.metadata?.cost && (
                      <span className="text-xs text-green-500">
                        ${message.metadata.cost.toFixed(4)}
                      </span>
                    )}
                    {message.metadata?.duration && (
                      <span className={`text-xs ${
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      }`}>
                        {message.metadata.duration}ms
                      </span>
                    )}
                  </div>
                  
                  <div className={`whitespace-pre-wrap break-words ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    {message.content}
                  </div>

                  {message.type === 'assistant' && (
                    <button
                      onClick={() => copyToClipboard(message.content)}
                      className={`mt-2 text-xs flex items-center space-x-1 transition-colors ${
                        theme === 'dark' 
                          ? 'text-gray-500 hover:text-gray-300' 
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {isProcessing && (
            <div className="flex items-center space-x-2 text-blue-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing...</span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className={`border-t p-4 ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex space-x-2">
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
              placeholder="Enter your prompt..."
              className={`flex-1 px-3 py-2 rounded-md border resize-none transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-400'
              } focus:outline-none focus:ring-1 focus:ring-blue-500`}
              rows={3}
              disabled={isProcessing}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isProcessing}
              className={`px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50 ${
                theme === 'dark'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-700'
                  : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300'
              }`}
            >
              {isProcessing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
          
          <div className={`mt-2 text-xs ${
            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          }`}>
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
};