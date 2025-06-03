import React, { useState } from 'react';
import { Play, Square, RotateCcw, Tag, Send, RefreshCw } from 'lucide-react';
import { Repository, WorkflowRun, PublishRequest } from '@/types';
import { githubService } from '@/services';
import { useQuery } from '@apollo/client';
import { LIST_USER_REPOSITORIES } from '@/graphql/github-operations';
import { useToastContext } from '@/components/Toast';
import { WorkflowCard } from './WorkflowCard';
import { PublishModal } from './PublishModal';
import { ErrorBoundary } from '../ErrorDisplay';
import { ErrorMessage } from '../ErrorDisplay';
import { LoadingOverlay } from '../LoadingStates';
import { CardSkeleton } from '../LoadingStates';
import clsx from 'clsx';

export const PipelineControlGraphQL: React.FC = () => {
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [selectedForPublish, setSelectedForPublish] = useState<Repository | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const { showSuccess, showError } = useToastContext();

  // Check if GitHub token is available
  const hasToken = !!import.meta.env.VITE_GITHUB_TOKEN;

  // Fetch repositories using GraphQL
  const { data, loading: reposLoading, error: reposError, refetch: refreshRepos } = useQuery(
    LIST_USER_REPOSITORIES,
    {
      variables: {
        perPage: 50,
        sort: 'updated'
      },
      fetchPolicy: 'cache-and-network',
      pollInterval: 60000, // Refresh every minute
      skip: !hasToken,
    }
  );

  const repositories = React.useMemo(() => {
    if (!data?.GitHub_reposListForAuthenticatedUser) return [];
    
    return data.GitHub_reposListForAuthenticatedUser
      .filter((repo: any) => repo.name.includes('gothic') || isMetaGOTHICPackage(repo.name))
      .map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || '',
        url: `https://github.com/${repo.full_name}`,
        isSubmodule: true,
        packageName: `@meta-gothic/${repo.name}`,
        version: '0.0.0',
        lastCommit: {
          sha: '',
          message: '',
          author: repo.owner.login,
          date: repo.pushed_at,
        },
      }));
  }, [data]);

  const isMetaGOTHICPackage = (name: string): boolean => {
    const metaGOTHICPackages = [
      'claude-client',
      'prompt-toolkit', 
      'sdlc-config',
      'sdlc-engine',
      'sdlc-content',
      'graphql-toolkit',
      'context-aggregator',
      'ui-components',
      'github-graphql-client',
    ];
    
    return metaGOTHICPackages.includes(name);
  };

  const handleTriggerWorkflow = async (repository: string, workflow: string) => {
    setIsTriggering(true);
    try {
      await githubService.triggerWorkflow({
        repository,
        workflow,
      });
      
      showSuccess('Workflow triggered', `Successfully triggered ${workflow} for ${repository}`);
      // Refresh to get the new workflow status
      setTimeout(() => refreshRepos(), 2000);
    } catch (error) {
      showError('Failed to trigger workflow', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsTriggering(false);
    }
  };

  const handleCancelWorkflow = async (repository: string, runId: number) => {
    try {
      await githubService.cancelWorkflow({
        repository,
        runId,
      });
      showSuccess('Workflow cancelled', `Successfully cancelled workflow run ${runId}`);
      setTimeout(() => refreshRepos(), 2000);
    } catch (error) {
      showError('Failed to cancel workflow', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handlePublish = async (request: PublishRequest) => {
    try {
      await githubService.publishPackage(request);
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
              disabled={reposLoading}
              className={clsx(
                'flex items-center space-x-2 px-4 py-2 rounded-md',
                'bg-blue-600 text-white hover:bg-blue-700',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-200'
              )}
            >
              <RefreshCw className={clsx('h-4 w-4', reposLoading && 'animate-spin')} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!hasToken && (
          <ErrorMessage
            title="GitHub Token Required"
            message="Please set your VITE_GITHUB_TOKEN environment variable to access GitHub repositories."
            showRetry={false}
          />
        )}

        {reposError && (
          <ErrorMessage
            title="Failed to load repositories"
            message={reposError.message || 'An error occurred while fetching repositories'}
            onRetry={refreshRepos}
          />
        )}

        {reposLoading && repositories.length === 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {!reposLoading && repositories.length === 0 && !reposError && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No repositories found. Make sure you have access to the organization repositories.
            </p>
          </div>
        )}

        {repositories.length > 0 && (
          <>
            <div className="mb-6">
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">All Repositories</option>
                {repositories.map((repo) => (
                  <option key={repo.id} value={repo.name}>
                    {repo.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredRepos?.map((repo) => (
                <WorkflowCard
                  key={repo.id}
                  repository={repo}
                  onTriggerWorkflow={handleTriggerWorkflow}
                  onCancelWorkflow={handleCancelWorkflow}
                  onPublishPackage={() => {
                    setSelectedForPublish(repo);
                    setShowPublishModal(true);
                  }}
                  isTriggering={isTriggering}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {showPublishModal && selectedForPublish && (
        <PublishModal
          repository={selectedForPublish}
          onPublish={handlePublish}
          onClose={() => {
            setShowPublishModal(false);
            setSelectedForPublish(null);
          }}
        />
      )}
    </div>
  );
};