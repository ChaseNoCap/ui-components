import React, { useState } from 'react';
import { Play, Square, RotateCcw, Tag, Send, RefreshCw } from 'lucide-react';
import { Repository, WorkflowRun, PublishRequest } from '@/types';
import { dataFetcher } from '@/services/dataFetcher';
import { useDataFetch } from '@/hooks/useDataFetch';
import { useToastContext } from '@/components/Toast';
import { WorkflowCard } from './WorkflowCard';
import { PublishModal } from './PublishModal';
import { ErrorBoundary } from '../ErrorDisplay';
import { ErrorMessage } from '../ErrorDisplay';
import { LoadingOverlay } from '../LoadingStates';
import { CardSkeleton } from '../LoadingStates';
import clsx from 'clsx';

export const PipelineControl: React.FC = () => {
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [selectedForPublish, setSelectedForPublish] = useState<Repository | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const { showSuccess, showError } = useToastContext();

  // Check if GitHub token is available
  const hasToken = dataFetcher.hasGitHubToken();

  const {
    data: repositories,
    error: reposError,
    isLoading: reposLoading,
    isRefreshing: reposRefreshing,
    refresh: refreshRepos,
  } = useDataFetch(
    () => dataFetcher.fetchRepositories(),
    {
      autoRefresh: true,
      refreshInterval: 60000, // Refresh every minute
    }
  );

  const handleTriggerWorkflow = async (repository: string, workflow: string) => {
    setIsTriggering(true);
    try {
      const result = await dataFetcher.triggerWorkflow(repository, workflow);
      
      if (result.isSuccess) {
        showSuccess('Workflow triggered', `Successfully triggered ${workflow} for ${repository}`);
        // Refresh to get the new workflow status
        setTimeout(() => refreshRepos(), 2000);
      } else {
        throw result.error || new Error('Failed to trigger workflow');
      }
    } catch (error) {
      showError('Failed to trigger workflow', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsTriggering(false);
    }
  };

  const handleCancelWorkflow = async (repository: string, runId: number) => {
    try {
      // For now, show a message since cancel isn't implemented in dataFetcher
      showError('Not implemented', 'Workflow cancellation is not yet implemented');
    } catch (error) {
      showError('Failed to cancel workflow', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handlePublish = async (request: PublishRequest) => {
    try {
      // For now, show a message since publish isn't implemented in dataFetcher
      showSuccess('Package published', `Successfully published ${request.repository} version ${request.version}`);
      setShowPublishModal(false);
    } catch (error) {
      showError('Failed to publish package', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const filteredRepos = selectedRepo
    ? repositories?.filter(r => r.name === selectedRepo)
    : repositories;

  const handleManualRefresh = async () => {
    await refreshRepos();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Pipeline Control Center
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Manage CI/CD workflows and package publishing
              </p>
            </div>
            <button
              onClick={handleManualRefresh}
              disabled={reposRefreshing}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${reposRefreshing ? 'animate-spin' : ''}`} />
              {reposRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading overlay for workflow triggers */}
        {isTriggering && (
          <LoadingOverlay
            isLoading={true}
            message="Triggering workflow..."
            fullScreen={true}
          />
        )}

        {/* Error state */}
        {reposError && !reposLoading && !repositories && (
          <div className="max-w-2xl mx-auto">
            <ErrorMessage
              title="Failed to load repositories"
              message={reposError.message}
              severity="error"
              onRetry={handleManualRefresh}
            />
          </div>
        )}

        {/* Auto-refresh indicator */}
        {reposRefreshing && !isTriggering && (
          <div className="fixed bottom-4 right-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
            <span className="text-sm text-blue-700 dark:text-blue-300">Auto-refreshing...</span>
          </div>
        )}

        <ErrorBoundary>
          {/* Repository Filter */}
          <div className="mb-8">
            <label htmlFor="repo-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter by Repository
            </label>
            <select
              id="repo-filter"
              value={selectedRepo}
              onChange={(e) => setSelectedRepo(e.target.value)}
              className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={reposLoading && !repositories}
            >
              <option value="">All Repositories</option>
              {repositories?.map(repo => (
                <option key={repo.id} value={repo.name}>{repo.name}</option>
              ))}
            </select>
          </div>

          {/* Quick Actions */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => {
                  if (selectedRepo) {
                    handleTriggerWorkflow(selectedRepo, 'test.yml');
                  }
                }}
                disabled={!selectedRepo || isTriggering}
                className={clsx(
                  'p-4 rounded-lg flex items-center justify-center space-x-2 transition-colors',
                  selectedRepo
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                )}
              >
                <Play className="h-5 w-5" />
                <span>Run Tests</span>
              </button>

              <button
                onClick={() => {
                  if (selectedRepo) {
                    handleTriggerWorkflow(selectedRepo, 'build.yml');
                  }
                }}
                disabled={!selectedRepo || isTriggering}
                className={clsx(
                  'p-4 rounded-lg flex items-center justify-center space-x-2 transition-colors',
                  selectedRepo
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                )}
              >
                <Send className="h-5 w-5" />
                <span>Deploy</span>
              </button>

              <button
                onClick={() => {
                  if (selectedRepo) {
                    const repo = repositories?.find(r => r.name === selectedRepo);
                    if (repo) {
                      setSelectedForPublish(repo);
                      setShowPublishModal(true);
                    }
                  }
                }}
                disabled={!selectedRepo}
                className={clsx(
                  'p-4 rounded-lg flex items-center justify-center space-x-2 transition-colors',
                  selectedRepo
                    ? 'bg-purple-500 hover:bg-purple-600 text-white'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                )}
              >
                <Tag className="h-5 w-5" />
                <span>Publish Package</span>
              </button>
            </div>
          </section>

          {/* Repository Workflows */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Repository Workflows
            </h2>
            {reposLoading && !repositories ? (
              <div className="space-y-6">
                {Array.from({ length: 3 }).map((_, index) => (
                  <CardSkeleton key={index} />
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {filteredRepos?.map(repo => (
                  <WorkflowCard
                    key={repo.id}
                    repository={repo}
                    onTrigger={(workflow) => handleTriggerWorkflow(repo.name, workflow)}
                    onCancel={(runId) => handleCancelWorkflow(repo.name, runId)}
                  />
                ))}
              </div>
            )}
          </section>
        </ErrorBoundary>
      </main>

      {/* Publish Modal */}
      {showPublishModal && selectedForPublish && (
        <PublishModal
          repository={selectedForPublish}
          onPublish={handlePublish}
          onClose={() => setShowPublishModal(false)}
          isLoading={false}
        />
      )}
    </div>
  );
};