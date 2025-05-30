import React, { useState, useEffect } from 'react';
import { Activity, AlertCircle, CheckCircle, Clock, Package, RefreshCw } from 'lucide-react';
import { HealthMetrics, Repository } from '@/types';
import { dataFetcher } from '@/services/dataFetcher';
import { useDataFetch } from '@/hooks/useDataFetch';
import { useLoadingStages } from '@/hooks/useLoadingStages';
import { RepositoryCard } from './RepositoryCard';
import { MetricsOverview } from './MetricsOverview';
import { WorkflowList } from './WorkflowList';
import { ErrorBoundary } from '../ErrorDisplay';
import { ErrorMessage } from '../ErrorDisplay';
import { LoadingModal, LoadingOverlay } from '../LoadingStates';
import { 
  RepositoryCardSkeleton, 
  MetricsOverviewSkeleton, 
  WorkflowListSkeleton,
  LoadingTimeout 
} from '../Skeleton';
import { useToastContext } from '../Toast';

export const HealthDashboard: React.FC = () => {
  const [manualRefreshInProgress, setManualRefreshInProgress] = useState(false);
  const [showLoadingModal, setShowLoadingModal] = useState(false);

  // Check if GitHub token is available
  const hasToken = dataFetcher.hasGitHubToken();
  
  // Loading stages for the modal
  const {
    stages,
    setStageStatus,
    reset: resetStages,
    isLoading: stagesLoading,
    isComplete,
    hasError: stagesHasError,
  } = useLoadingStages([
    { id: 'token', label: 'Validating GitHub token' },
    { id: 'repositories', label: 'Fetching repositories' },
    { id: 'processing', label: 'Processing health data and workflows' },
  ]);
  
  // Show error if no token
  if (!hasToken) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-8">
        <ErrorMessage
          title="GitHub Token Required"
          message="Please set VITE_GITHUB_TOKEN in your .env.local file to access GitHub data"
          severity="error"
        />
      </div>
    );
  }

  const {
    data: repositories,
    error: reposError,
    isLoading: reposLoading,
    isRefreshing: reposRefreshing,
    refresh: refreshRepos,
  } = useDataFetch(
    async () => {
      // Set loading status when starting
      setStageStatus('repositories', 'loading', 'Fetching your repositories...');
      
      const result = await dataFetcher.fetchRepositories();
      
      if (result.isSuccess) {
        setStageStatus('repositories', 'success', `Found ${result.data?.length || 0} repositories`);
      } else {
        setStageStatus('repositories', 'error', 'Failed to fetch repositories', result.error?.message);
      }
      
      return result;
    },
    {
      autoRefresh: true,
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  );

  const {
    data: healthMetrics,
    error: metricsError,
    isLoading: metricsLoading,
    isRefreshing: metricsRefreshing,
    refresh: refreshMetrics,
  } = useDataFetch(
    async () => {
      if (!repositories) {
        return { data: [], error: null, isLoading: false, isError: false, isSuccess: true };
      }
      
      if (metricsLoading && !healthMetrics) {
        setStageStatus('processing', 'loading', 'Processing health data and workflows...');
      }
      
      // Fetch health metrics for all repositories at once
      const result = await dataFetcher.fetchHealthMetrics();
      
      // Debug logging to see what we're actually getting
      console.log('🔍 Debug - Repositories:', repositories);
      console.log('🔍 Debug - Health metrics result:', result);
      console.log('🔍 Debug - Health metrics data:', result.data);
      
      if (result.isError || !result.data) {
        setStageStatus('processing', 'error', 'Failed to process data', result.error?.message);
        throw result.error || new Error('Failed to fetch health metrics');
      }
      
      setStageStatus('processing', 'success', `Processed ${result.data.length} repositories with health and workflow data`);
      
      return { data: result.data, error: null, isLoading: false, isError: false, isSuccess: true };
    },
    {
      autoRefresh: true,
      refreshInterval: 10000, // Refresh every 10 seconds
    }
  );

  const loading = reposLoading || metricsLoading;
  const isRefreshing = reposRefreshing || metricsRefreshing;
  const hasError = reposError || metricsError;

  const getOverallHealth = () => {
    if (!healthMetrics || healthMetrics.length === 0) return 'unknown';
    const statuses = healthMetrics.map(m => m.status);
    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('warning')) return 'warning';
    return 'healthy';
  };

  const overallHealth = getOverallHealth();

  // Handle initial loading modal
  useEffect(() => {
    // Show modal when starting to load (either initial or manual refresh)
    if ((reposLoading || metricsLoading) && (!repositories || !healthMetrics || manualRefreshInProgress)) {
      if (!showLoadingModal) {
        setShowLoadingModal(true);
        resetStages();
        
        // Token validation is instant since we just check the env variable
        setStageStatus('token', 'success', 'GitHub token validated');
      }
    } else if (repositories && healthMetrics && isComplete && showLoadingModal) {
      // Auto-close modal after 1.5 seconds when complete
      const timer = setTimeout(() => setShowLoadingModal(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [reposLoading, metricsLoading, repositories, healthMetrics, isComplete, manualRefreshInProgress, showLoadingModal, resetStages, setStageStatus]);

  const handleManualRefresh = async () => {
    setManualRefreshInProgress(true);
    // The useEffect will handle showing the modal and resetting stages
    
    try {
      await Promise.all([refreshRepos(), refreshMetrics()]);
    } finally {
      setManualRefreshInProgress(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                metaGOTHIC Health Monitor
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Real-time monitoring of all metaGOTHIC packages and pipelines
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleManualRefresh}
                disabled={manualRefreshInProgress}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${manualRefreshInProgress ? 'animate-spin' : ''}`} />
                {manualRefreshInProgress ? 'Refreshing...' : 'Refresh'}
              </button>
              <div className="flex items-center space-x-2">
                {overallHealth === 'healthy' && (
                  <CheckCircle className="h-8 w-8 text-green-500" />
                )}
                {overallHealth === 'warning' && (
                  <AlertCircle className="h-8 w-8 text-yellow-500" />
                )}
                {overallHealth === 'critical' && (
                  <AlertCircle className="h-8 w-8 text-red-500" />
                )}
                <span className="text-lg font-medium capitalize">
                  {overallHealth}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading overlay for manual refresh */}
        {manualRefreshInProgress && (
          <LoadingOverlay
            isLoading={true}
            message="Refreshing dashboard data..."
            fullScreen={true}
          />
        )}
        
        {/* Show error state if initial load fails */}
        {hasError && !loading && !repositories && (
          <div className="max-w-2xl mx-auto">
            <ErrorMessage
              title="Failed to load dashboard data"
              message={reposError?.message || metricsError?.message || 'Unknown error occurred'}
              severity="error"
              onRetry={handleManualRefresh}
            />
          </div>
        )}

        {/* Auto-refresh indicator */}
        {isRefreshing && !manualRefreshInProgress && !showLoadingModal && (
          <div className="fixed bottom-4 right-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center space-x-2 shadow-lg">
            <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
            <span className="text-sm text-blue-700 dark:text-blue-300">Auto-refreshing data...</span>
          </div>
        )}

        <div className="space-y-8">
          {/* Metrics Overview */}
          <ErrorBoundary>
            <LoadingTimeout 
              isLoading={metricsLoading && !healthMetrics} 
              timeout={30000}
              onTimeout={() => console.warn('Metrics loading timed out after 30 seconds')}
            >
              {metricsLoading && !healthMetrics ? (
                <MetricsOverviewSkeleton />
              ) : metricsError && !healthMetrics ? (
                <ErrorMessage
                  title="Failed to load metrics"
                  message={metricsError.message}
                  severity="error"
                  onRetry={refreshMetrics}
                />
              ) : (
                <MetricsOverview metrics={healthMetrics || []} />
              )}
            </LoadingTimeout>
          </ErrorBoundary>

          {/* Repository Grid */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Repositories
            </h2>
            <ErrorBoundary>
              <LoadingTimeout 
                isLoading={reposLoading && !repositories} 
                timeout={30000}
                onTimeout={() => console.warn('Repository loading timed out after 30 seconds')}
              >
                {reposLoading && !repositories ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <RepositoryCardSkeleton key={index} />
                    ))}
                  </div>
                ) : reposError && !repositories ? (
                  <ErrorMessage
                    title="Failed to load repositories"
                    message={reposError.message}
                    severity="error"
                    onRetry={refreshRepos}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {repositories?.map((repo) => (
                      <RepositoryCard
                        key={repo.id}
                        repository={repo}
                        metrics={healthMetrics?.find(m => m.repository === repo.name)}
                      />
                    ))}
                  </div>
                )}
              </LoadingTimeout>
            </ErrorBoundary>
          </section>

          {/* Recent Workflows */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Recent Workflow Runs
            </h2>
            <ErrorBoundary>
              <LoadingTimeout 
                isLoading={metricsLoading && !healthMetrics} 
                timeout={30000}
                onTimeout={() => console.warn('Workflow loading timed out after 30 seconds')}
              >
                {metricsLoading && !healthMetrics ? (
                  <WorkflowListSkeleton />
                ) : metricsError && !healthMetrics ? (
                  <ErrorMessage
                    title="Failed to load workflows"
                    message={metricsError.message}
                    severity="error"
                    onRetry={refreshMetrics}
                  />
                ) : (
                  <WorkflowList metrics={healthMetrics || []} />
                )}
              </LoadingTimeout>
            </ErrorBoundary>
          </section>
        </div>
      </main>
      
      {/* Loading Modal */}
      <LoadingModal
        isOpen={showLoadingModal}
        title={manualRefreshInProgress ? 'Refreshing Dashboard' : 'Loading Dashboard'}
        stages={stages}
        onClose={() => setShowLoadingModal(false)}
        allowClose={isComplete || stagesHasError}
      />
    </div>
  );
};