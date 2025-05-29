import React, { useState } from 'react';
import { Sparkles, Edit2, Check, X } from 'lucide-react';
import { useTheme } from '../../context';
import { toolsService, type PackageChanges, type CommitMessage } from '../../services/toolsService';
import { ApiError } from '../ApiError';

interface CommitMessageGeneratorProps {
  changes: PackageChanges[];
  onMessagesGenerated?: (messages: CommitMessage[]) => void;
}

export const CommitMessageGenerator: React.FC<CommitMessageGeneratorProps> = ({ 
  changes, 
  onMessagesGenerated 
}) => {
  const { theme } = useTheme();
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<CommitMessage[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedMessages, setEditedMessages] = useState<CommitMessage[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const generateMessages = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const generatedMessages = await toolsService.generateCommitMessages(changes);
      setMessages(generatedMessages);
      setEditedMessages(generatedMessages);
      onMessagesGenerated?.(generatedMessages);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
  };

  const handleSave = (index: number) => {
    const updated = [...editedMessages];
    setMessages(updated);
    setEditingIndex(null);
    onMessagesGenerated?.(updated);
  };

  const handleCancel = () => {
    setEditedMessages([...messages]);
    setEditingIndex(null);
  };

  const updateMessage = (index: number, field: 'message' | 'description', value: string) => {
    const updated = [...editedMessages];
    updated[index] = { ...updated[index], [field]: value };
    setEditedMessages(updated);
  };

  if (error) {
    return (
      <ApiError
        error={error}
        onRetry={generateMessages}
        title="Failed to generate commit messages"
      />
    );
  }

  if (changes.length === 0) {
    return (
      <div className={`
        text-center py-8 rounded-lg border
        ${theme === 'dark' 
          ? 'bg-gray-800 border-gray-700 text-gray-400' 
          : 'bg-gray-50 border-gray-200 text-gray-600'
        }
      `}>
        <p>No changes to generate commit messages for</p>
        <p className="text-sm mt-2">Scan for changes first to generate commit messages</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Commit Messages</h3>
        <button
          onClick={generateMessages}
          disabled={isGenerating}
          className={`
            flex items-center space-x-2 px-4 py-2 rounded-md transition-colors
            ${isGenerating 
              ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed' 
              : 'bg-purple-500 hover:bg-purple-600 text-white'
            }
          `}
        >
          <Sparkles className={`h-4 w-4 ${isGenerating ? 'animate-pulse' : ''}`} />
          <span>{isGenerating ? 'Generating...' : 'Generate with AI'}</span>
        </button>
      </div>

      {messages.length > 0 && (
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div
              key={msg.package}
              className={`
                p-4 rounded-lg border
                ${theme === 'dark' 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-200'
                }
              `}
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-lg">{msg.package}</h4>
                {editingIndex !== index ? (
                  <button
                    onClick={() => handleEdit(index)}
                    className={`
                      p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700
                      transition-colors
                    `}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleSave(index)}
                      className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900 text-green-600"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleCancel}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {editingIndex === index ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editedMessages[index].message}
                    onChange={(e) => updateMessage(index, 'message', e.target.value)}
                    className={`
                      w-full px-3 py-2 rounded border font-mono text-sm
                      ${theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-gray-100'
                        : 'bg-white border-gray-300 text-gray-900'
                      }
                    `}
                  />
                  <textarea
                    value={editedMessages[index].description || ''}
                    onChange={(e) => updateMessage(index, 'description', e.target.value)}
                    rows={3}
                    className={`
                      w-full px-3 py-2 rounded border text-sm
                      ${theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-gray-100'
                        : 'bg-white border-gray-300 text-gray-900'
                      }
                    `}
                    placeholder="Optional description..."
                  />
                </div>
              ) : (
                <div>
                  <p className={`font-mono text-sm ${
                    theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                  }`}>
                    {msg.message}
                  </p>
                  {msg.description && (
                    <p className={`mt-2 text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {msg.description}
                    </p>
                  )}
                </div>
              )}

              <div className={`mt-3 text-xs ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}>
                {changes.find(c => c.package === msg.package)?.changes.length || 0} files changed
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};