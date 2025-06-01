import React, { useState, useEffect } from 'react';
import { GitCommit, Send, RefreshCw, AlertCircle, FileText, Plus, Minus, Edit } from 'lucide-react';
import { LoadingModal } from '../components/LoadingStates/LoadingModal';
import { useToast } from '../components/Toast';
import clsx from 'clsx';

interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
}

interface Repository {
  name: string;
  path: string;
  hasChanges: boolean;
}

export const ManualCommitPage: React.FC = () => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  // Fetch available repositories
  const fetchRepositories = async () => {
    try {
      const response = await fetch('http://localhost:3003/api/git/repositories');
      if (!response.ok) throw new Error('Failed to fetch repositories');
      
      const data = await response.json();
      setRepositories(data.repositories);
      
      // Auto-select first repository with changes
      const repoWithChanges = data.repositories.find((r: Repository) => r.hasChanges);
      if (repoWithChanges) {
        setSelectedRepo(repoWithChanges.path);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch repositories';
      showToast({ type: 'error', message: errorMessage });
    }
  };

  // Fetch changes for selected repository
  const fetchRepoChanges = async (repoPath: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:3003/api/git/status?path=${encodeURIComponent(repoPath)}`);
      if (!response.ok) throw new Error('Failed to fetch repository status');
      
      const data = await response.json();
      setFileChanges(data.files || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch changes';
      setError(errorMessage);
      showToast({ type: 'error', message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  // Generate AI commit message
  const generateCommitMessage = async () => {
    if (!selectedRepo || fileChanges.length === 0) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3003/api/claude/generate-commit-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: [{
            repository: selectedRepo,
            files: fileChanges
          }]
        })
      });
      
      if (!response.ok) throw new Error('Failed to generate commit message');
      
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        setCommitMessage(data.results[0].message);
        showToast({ type: 'success', message: 'AI commit message generated' });
      }
    } catch (err) {
      showToast({ type: 'error', message: 'Failed to generate commit message' });
    } finally {
      setIsLoading(false);
    }
  };

  // Commit changes
  const handleCommit = async () => {
    if (!selectedRepo || !commitMessage.trim()) {
      showToast({ type: 'error', message: 'Please enter a commit message' });
      return;
    }
    
    setIsCommitting(true);
    try {
      const response = await fetch('http://localhost:3003/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: selectedRepo,
          message: commitMessage
        })
      });
      
      if (!response.ok) throw new Error('Failed to commit changes');
      
      showToast({ type: 'success', message: 'Changes committed successfully' });
      setCommitMessage('');
      await fetchRepoChanges(selectedRepo);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to commit changes';
      showToast({ type: 'error', message: errorMessage });
    } finally {
      setIsCommitting(false);
    }
  };

  useEffect(() => {
    fetchRepositories();
  }, []);

  useEffect(() => {
    if (selectedRepo) {
      fetchRepoChanges(selectedRepo);
    }
  }, [selectedRepo]);

  const getFileIcon = (status: FileChange['status']) => {
    switch (status) {
      case 'added':
        return <Plus className="h-4 w-4 text-green-500" />;
      case 'modified':
        return <Edit className="h-4 w-4 text-yellow-500" />;
      case 'deleted':
        return <Minus className="h-4 w-4 text-red-500" />;
    }
  };

  if (isLoading && fileChanges.length === 0) {
    return (
      <LoadingModal
        isOpen={true}
        stages={[
          { key: 'fetch', label: 'Fetching repository changes', status: 'active' }
        ]}
        currentStage="fetch"
      />
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manual Commit</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Review changes and create commits with optional AI assistance
        </p>
      </div>

      {/* Repository Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Repository
        </label>
        <select
          value={selectedRepo}
          onChange={(e) => setSelectedRepo(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="">Choose a repository...</option>
          {repositories.map((repo) => (
            <option key={repo.path} value={repo.path}>
              {repo.name} {repo.hasChanges && '(has changes)'}
            </option>
          ))}
        </select>
      </div>

      {selectedRepo && (
        <>
          {/* File Changes */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                File Changes ({fileChanges.length})
              </h2>
              <button
                onClick={() => fetchRepoChanges(selectedRepo)}
                disabled={isLoading}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
              {fileChanges.map((file) => (
                <div key={file.path} className="p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getFileIcon(file.status)}
                    <span className="text-sm text-gray-900 dark:text-white font-mono">
                      {file.path}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="text-green-600 dark:text-green-400">+{file.additions}</span>
                    <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>
                  </div>
                </div>
              ))}
            </div>

            {fileChanges.length === 0 && (
              <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">No changes in this repository</p>
              </div>
            )}
          </div>

          {/* Commit Message */}
          {fileChanges.length > 0 && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Commit Message
                  </label>
                  <button
                    onClick={generateCommitMessage}
                    disabled={isLoading}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Generate with AI
                  </button>
                </div>
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Enter your commit message..."
                />
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={handleCommit}
                  disabled={!commitMessage.trim() || isCommitting}
                  className={clsx(
                    'flex items-center space-x-2 px-4 py-2 rounded-md font-medium',
                    'bg-blue-600 text-white hover:bg-blue-700',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <GitCommit className="h-4 w-4" />
                  <span>{isCommitting ? 'Committing...' : 'Commit Changes'}</span>
                </button>

                <button
                  onClick={() => setCommitMessage('')}
                  disabled={!commitMessage || isCommitting}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};