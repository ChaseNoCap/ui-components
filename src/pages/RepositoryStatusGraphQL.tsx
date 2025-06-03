import React, { useState } from 'react';
import { GitBranch, RefreshCw, AlertCircle, CheckCircle2, Clock, GitCommit } from 'lucide-react';
import { LoadingModal } from '../components/LoadingStates/LoadingModal';
import { useToast } from '../components/Toast';
import { useQuery } from '@apollo/client';
import { SCAN_ALL_REPOSITORIES } from '../graphql/git-operations';
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

export const RepositoryStatusPageGraphQL: React.FC = () => {
  const { showToast } = useToast();
  
  const { data, loading, error, refetch } = useQuery(SCAN_ALL_REPOSITORIES, {
    fetchPolicy: 'network-only',
    onError: (error) => {
      showToast({
        type: 'error',
        message: error.message || 'Failed to fetch repository status'
      });
    }
  });

  const repositories = React.useMemo<RepositoryStatus[]>(() => {
    if (!data?.scanAllRepositories) return [];
    
    return data.scanAllRepositories.map((repo: any) => ({
      name: repo.name,
      path: repo.path,
      branch: repo.status.branch || 'main',
      status: repo.status.isClean ? 'clean' : 'dirty',
      ahead: repo.status.ahead || 0,
      behind: repo.status.behind || 0,
      lastCommit: {
        hash: '',
        message: '',
        author: '',
        date: ''
      },
      uncommittedChanges: repo.status.uncommittedCount || 0
    }));
  }, [data]);

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

  if (loading) {
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
          onClick={() => refetch()}
          disabled={loading}
          className="flex items-center space-x-2 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-600 dark:text-red-400">
              {error.message || 'Failed to fetch repository status'}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {repositories.map((repo) => (
          <div
            key={repo.path}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                {getStatusIcon(repo.status)}
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {repo.name}
                </h3>
              </div>
              <span className={clsx(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                getStatusBadgeClass(repo.status)
              )}>
                {repo.status}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                <GitBranch className="h-4 w-4" />
                <span>{repo.branch}</span>
              </div>

              {repo.uncommittedChanges > 0 && (
                <div className="flex items-center space-x-2 text-yellow-600 dark:text-yellow-400">
                  <AlertCircle className="h-4 w-4" />
                  <span>{repo.uncommittedChanges} uncommitted changes</span>
                </div>
              )}

              {(repo.ahead > 0 || repo.behind > 0) && (
                <div className="flex items-center space-x-2">
                  <GitCommit className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">
                    {repo.ahead > 0 && <span className="text-green-600 dark:text-green-400">↑{repo.ahead}</span>}
                    {repo.ahead > 0 && repo.behind > 0 && ' '}
                    {repo.behind > 0 && <span className="text-red-600 dark:text-red-400">↓{repo.behind}</span>}
                  </span>
                </div>
              )}

              {repo.error && (
                <div className="text-red-600 dark:text-red-400 text-xs">
                  {repo.error}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {repositories.length === 0 && !error && (
        <div className="text-center py-12">
          <GitBranch className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">No repositories found</p>
        </div>
      )}
    </div>
  );
};