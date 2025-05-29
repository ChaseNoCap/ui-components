import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertCircle, CheckCircle, Clock, Package } from 'lucide-react';
import { HealthMetrics, Repository } from '@/types';
import { fetchHealthMetrics, fetchRepositories } from '@/services/api';
import { RepositoryCard } from './RepositoryCard';
import { MetricsOverview } from './MetricsOverview';
import { WorkflowList } from './WorkflowList';
import { QueryErrorBoundary } from '../ErrorBoundary';
import { 
  RepositoryCardSkeleton, 
  MetricsOverviewSkeleton, 
  WorkflowListSkeleton,
  LoadingTimeout 
} from '../Skeleton';

export const HealthDashboard: React.FC = () => {
  const { data: repositories, isLoading: reposLoading } = useQuery({
    queryKey: ['repositories'],
    queryFn: fetchRepositories,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: healthMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['health-metrics'],
    queryFn: fetchHealthMetrics,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const loading = reposLoading || metricsLoading;

  const getOverallHealth = () => {
    if (!healthMetrics) return 'unknown';
    const statuses = healthMetrics.map(m => m.status);
    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('warning')) return 'warning';
    return 'healthy';
  };

  const overallHealth = getOverallHealth();

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
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Metrics Overview */}
          <QueryErrorBoundary>
            <LoadingTimeout 
              isLoading={metricsLoading} 
              timeout={30000}
              onTimeout={() => console.warn('Metrics loading timed out after 30 seconds')}
            >
              {metricsLoading ? (
                <MetricsOverviewSkeleton />
              ) : (
                <MetricsOverview metrics={healthMetrics || []} />
              )}
            </LoadingTimeout>
          </QueryErrorBoundary>

          {/* Repository Grid */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Repositories
            </h2>
            <QueryErrorBoundary>
              <LoadingTimeout 
                isLoading={reposLoading} 
                timeout={30000}
                onTimeout={() => console.warn('Repository loading timed out after 30 seconds')}
              >
                {reposLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <RepositoryCardSkeleton key={index} />
                    ))}
                  </div>
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
            </QueryErrorBoundary>
          </section>

          {/* Recent Workflows */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Recent Workflow Runs
            </h2>
            <QueryErrorBoundary>
              <LoadingTimeout 
                isLoading={metricsLoading} 
                timeout={30000}
                onTimeout={() => console.warn('Workflow loading timed out after 30 seconds')}
              >
                {metricsLoading ? (
                  <WorkflowListSkeleton />
                ) : (
                  <WorkflowList metrics={healthMetrics || []} />
                )}
              </LoadingTimeout>
            </QueryErrorBoundary>
          </section>
        </div>
      </main>
    </div>
  );
};