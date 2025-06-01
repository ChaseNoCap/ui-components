import React, { useState, useEffect } from 'react';
import { GitBranch, RefreshCw, AlertCircle, CheckCircle2, Clock, GitCommit } from 'lucide-react';
import { LoadingModal } from '../components/LoadingStates/LoadingModal';
import { useToast } from '../components/Toast';
import clsx from 'clsx';

interface RepositoryStatus {
  name: string;
  path: string;
  branch: string;
  status: 'clean' | 'dirty' | 'error';
  ahead: number;
  behind: number;
  lastCommit: {
    hash: string;
    message: string;
    author: string;
    date: string;
  };
  uncommittedChanges: number;
  error?: string;
}

export const RepositoryStatusPage: React.FC = () => {
  const [repositories, setRepositories] = useState<RepositoryStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const fetchRepositoryStatus = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3003/api/git/all-status');
      if (!response.ok) {
        throw new Error('Failed to fetch repository status');
      }

      const data = await response.json();
      setRepositories(data.repositories);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch repository status';
      setError(errorMessage);
      showToast({
        type: 'error',
        message: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRepositoryStatus();
  }, []);

  const getStatusIcon = (status: RepositoryStatus['status']) => {
    switch (status) {
      case 'clean':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'dirty':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusBadgeClass = (status: RepositoryStatus['status']) => {
    switch (status) {
      case 'clean':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'dirty':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    }
  };

  if (isLoading) {
    return (
      <LoadingModal
        isOpen={true}
        stages={[
          { key: 'scan', label: 'Scanning repositories', status: 'active' }
        ]}
        currentStage="scan"
      />
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Repository Status</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Real-time status of all metaGOTHIC repositories
          </p>
        </div>
        <button
          onClick={fetchRepositoryStatus}
          disabled={isLoading}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {repositories.map((repo) => (
          <div
            key={repo.path}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <GitBranch className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">{repo.name}</h3>
              </div>
              {getStatusIcon(repo.status)}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Branch:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{repo.branch}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                <span className={clsx(
                  'text-xs px-2 py-1 rounded-full font-medium',
                  getStatusBadgeClass(repo.status)
                )}>
                  {repo.status === 'clean' ? 'Clean' : repo.status === 'dirty' ? 'Uncommitted changes' : 'Error'}
                </span>
              </div>

              {repo.uncommittedChanges > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Changes:</span>
                  <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                    {repo.uncommittedChanges} file{repo.uncommittedChanges !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {(repo.ahead > 0 || repo.behind > 0) && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Sync:</span>
                  <div className="flex items-center space-x-2 text-sm">
                    {repo.ahead > 0 && (
                      <span className="text-green-600 dark:text-green-400">↑{repo.ahead}</span>
                    )}
                    {repo.behind > 0 && (
                      <span className="text-red-600 dark:text-red-400">↓{repo.behind}</span>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-start space-x-2">
                  <GitCommit className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {repo.lastCommit.hash.substring(0, 7)} • {repo.lastCommit.author}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                      {repo.lastCommit.message}
                    </p>
                  </div>
                </div>
              </div>

              {repo.error && (
                <div className="pt-2">
                  <p className="text-xs text-red-600 dark:text-red-400">{repo.error}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {repositories.length === 0 && !error && !isLoading && (
        <div className="text-center py-12">
          <GitBranch className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No repositories found</p>
        </div>
      )}
    </div>
  );
};