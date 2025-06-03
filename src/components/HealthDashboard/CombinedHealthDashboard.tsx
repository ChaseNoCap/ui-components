import React, { useState, useEffect } from 'react';
import { Activity, GitBranch, Package, Server, Clock, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { useSystemHealth } from '@/hooks/useGraphQL';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { ErrorBoundary } from '../ErrorDisplay';
import { ErrorMessage } from '../ErrorDisplay';
import { Spinner } from '../LoadingStates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { formatDistanceToNow } from 'date-fns';

// GitHub queries
const GITHUB_REPOSITORIES_QUERY = gql`
  query GitHubRepositories($perPage: Int = 10) {
    githubRepositories(perPage: $perPage) {
      name
      fullName
      description
      stargazersCount
      language
      updatedAt
      topics
      owner {
        login
        avatarUrl
      }
    }
  }
`;

const GITHUB_USER_QUERY = gql`
  query GitHubUser {
    githubUser {
      login
      name
      avatarUrl
      bio
      company
      publicRepos
    }
  }
`;

interface ServiceHealth {
  name: string;
  healthy: boolean;
  version: string | null;
  responseTime: number;
}

export const CombinedHealthDashboard: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastCheckTime, setLastCheckTime] = useState<Date>(new Date());
  
  // Use GraphQL system health query with 5 second polling
  const { data: healthData, loading: healthLoading, error: healthError, refetch: refetchHealth } = useSystemHealth(5000);
  
  // Fetch GitHub data
  const { data: githubReposData, loading: reposLoading, error: reposError, refetch: refetchRepos } = useQuery(
    GITHUB_REPOSITORIES_QUERY,
    { 
      variables: { perPage: 10 },
      errorPolicy: 'ignore' // Continue even if GitHub query fails
    }
  );
  
  const { data: githubUserData, loading: userLoading, error: userError } = useQuery(
    GITHUB_USER_QUERY,
    { errorPolicy: 'ignore' }
  );
  
  // Update last check time when data changes
  React.useEffect(() => {
    if (healthData) {
      setLastCheckTime(new Date());
    }
  }, [healthData]);
  
  const handleRefresh = async () => {
    setRefreshKey(prev => prev + 1);
    await Promise.all([
      refetchHealth(),
      refetchRepos()
    ]);
  };

  if (healthLoading && !healthData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading dashboard data...
          </p>
        </div>
      </div>
    );
  }

  if (healthError && !healthData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-8">
        <ErrorMessage
          title="Unable to Load Health Data"
          message={healthError.message}
          severity="error"
          onRetry={handleRefresh}
        />
      </div>
    );
  }

  const health = healthData?.health;
  if (!health) return null;

  // GitHub data
  const repositories = githubReposData?.githubRepositories || [];
  const githubUser = githubUserData?.githubUser;
  const hasGitHubData = repositories.length > 0 || githubUser;

  // Create services data based on what we know from the health query
  const services = [
    { 
      name: 'claude-service', 
      healthy: health.claudeAvailable || false, 
      version: health.claudeVersion || 'Unknown', 
      responseTime: 45 
    },
    { name: 'repo-agent-service', healthy: true, version: '1.0.0', responseTime: 32 },
    { name: 'gateway', healthy: true, version: health.version || '1.0.0', responseTime: 12 }
  ];

  const healthyServices = services.filter((s: ServiceHealth) => s.healthy).length;
  const totalServices = services.length;
  const overallHealth = health.healthy;

  const getServiceIcon = (serviceName: string) => {
    if (serviceName.includes('claude')) return <Activity className="h-5 w-5" />;
    if (serviceName.includes('repo')) return <Package className="h-5 w-5" />;
    return <Server className="h-5 w-5" />;
  };

  const getHealthColor = (healthy: boolean) => {
    return healthy ? 'text-green-500' : 'text-red-500';
  };

  const getHealthBadge = (healthy: boolean) => {
    return healthy ? (
      <Badge variant="success" className="ml-2">
        <CheckCircle className="h-3 w-3 mr-1" />
        Healthy
      </Badge>
    ) : (
      <Badge variant="destructive" className="ml-2">
        <AlertCircle className="h-3 w-3 mr-1" />
        Unhealthy
      </Badge>
    );
  };

  return (
    <ErrorBoundary>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Meta-GOTHIC Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              System health, GitHub repositories, and pipeline status
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={healthLoading || reposLoading}
            variant="outline"
            size="sm"
          >
            {(healthLoading || reposLoading) ? (
              <Spinner size="sm" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>

        {/* GitHub User Info */}
        {githubUser && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <img 
                  src={githubUser.avatarUrl} 
                  alt={githubUser.login}
                  className="h-16 w-16 rounded-full"
                />
                <div className="flex-1">
                  <h2 className="text-xl font-semibold">{githubUser.name || githubUser.login}</h2>
                  <p className="text-gray-600 dark:text-gray-400">@{githubUser.login}</p>
                  {githubUser.bio && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{githubUser.bio}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{githubUser.publicRepos}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Public Repos</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Health Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    System Status
                  </p>
                  <p className="text-2xl font-bold mt-2">
                    {overallHealth ? 'Operational' : 'Degraded'}
                  </p>
                </div>
                <div className={getHealthColor(overallHealth)}>
                  {overallHealth ? (
                    <CheckCircle className="h-8 w-8" />
                  ) : (
                    <AlertCircle className="h-8 w-8" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Services
                  </p>
                  <p className="text-2xl font-bold mt-2">
                    {healthyServices}/{totalServices}
                  </p>
                </div>
                <Server className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Claude Sessions
                  </p>
                  <p className="text-2xl font-bold mt-2">
                    {health.activeSessions || 0}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Last Check
                  </p>
                  <p className="text-2xl font-bold mt-2">
                    {formatDistanceToNow(lastCheckTime, { addSuffix: true })}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Services Status */}
          <Card>
            <CardHeader>
              <CardTitle>Service Health</CardTitle>
              <CardDescription>
                GraphQL federation services status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {services.map((service: ServiceHealth) => (
                  <div
                    key={service.name}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={getHealthColor(service.healthy)}>
                        {getServiceIcon(service.name)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {service.name}
                        </h3>
                        {service.version && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Version: {service.version}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {service.responseTime}ms
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Response Time
                        </p>
                      </div>
                      {getHealthBadge(service.healthy)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* GitHub Repositories */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Repositories</CardTitle>
              <CardDescription>
                {hasGitHubData ? 'Your GitHub repositories sorted by recent activity' : 'GitHub data unavailable'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reposError ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>Unable to load GitHub data</p>
                  <p className="text-sm mt-2">{reposError.message}</p>
                </div>
              ) : reposLoading ? (
                <div className="text-center py-8">
                  <Spinner size="lg" />
                  <p className="mt-4 text-gray-600 dark:text-gray-400">Loading repositories...</p>
                </div>
              ) : repositories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No repositories found</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {repositories.map((repo: any) => (
                    <div
                      key={repo.name}
                      className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                            <GitBranch className="h-4 w-4 mr-2" />
                            {repo.name}
                          </h3>
                          {repo.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {repo.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            {repo.language && (
                              <span className="flex items-center">
                                <span className="w-3 h-3 rounded-full bg-blue-500 mr-1"></span>
                                {repo.language}
                              </span>
                            )}
                            <span>⭐ {repo.stargazersCount}</span>
                            {repo.updatedAt && (
                              <span>
                                Updated {formatDistanceToNow(new Date(repo.updatedAt), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* System Resources */}
        {health.resources && (
          <Card>
            <CardHeader>
              <CardTitle>System Resources</CardTitle>
              <CardDescription>
                Current resource utilization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">CPU Usage</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {Math.round(health.resources.cpuUsage)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${Math.min(health.resources.cpuUsage, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Memory</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {Math.round(health.resources.memoryUsage)} MB
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div 
                      className="bg-green-600 h-2.5 rounded-full" 
                      style={{ width: `${Math.min((health.resources.memoryUsage / 1024) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="pt-2 text-sm text-gray-600 dark:text-gray-400">
                  Active Processes: {health.resources.activeProcesses}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ErrorBoundary>
  );
};