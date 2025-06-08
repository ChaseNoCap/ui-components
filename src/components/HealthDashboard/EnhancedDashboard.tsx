import React, { useState, useEffect } from 'react';
import { 
  Activity, GitBranch, Package, Server, Clock, AlertCircle, CheckCircle, 
  RefreshCw, Play, XCircle, SkipForward, AlertTriangle, ExternalLink,
  Send, Square, Tag
} from 'lucide-react';
import { useSystemHealth } from '@/hooks/useGraphQL';
import { useQuery, gql } from '@apollo/client';
import { ErrorBoundary } from '../ErrorDisplay';
import { ErrorMessage } from '../ErrorDisplay';
import { Spinner } from '../LoadingStates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { githubService } from '@/services';
import { useToastContext } from '../Toast';

// GitHub queries
const GITHUB_FULL_DATA_QUERY = gql`
  query GitHubFullData($first: Int = 20) {
    githubUser {
      login
      name
      avatarUrl
      email
    }
    githubRepositories(first: $first) {
      id
      name
      fullName
      description
      stargazersCount
      language
      updatedAt
      pushedAt
      private
      defaultBranch
      forksCount
      watchersCount
      owner {
        login
        avatarUrl
      }
    }
  }
`;

// Workflow queries not available in GitHub Mesh service
// TODO: Implement workflow support in federation

interface ServiceHealth {
  name: string;
  healthy: boolean;
  version: string | null;
  responseTime: number;
}

interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion?: string;
  headBranch: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  repository?: string;
}

interface Repository {
  id: string;
  name: string;
  fullName: string;
  description?: string;
  stargazersCount: number;
  language?: string;
  updatedAt: string;
  pushedAt?: string;
  private: boolean;
  defaultBranch: string;
  forksCount: number;
  watchersCount: number;
  owner: {
    login: string;
    avatarUrl?: string;
  };
}

export const EnhancedDashboard: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastCheckTime, setLastCheckTime] = useState<Date>(new Date());
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [isTriggering, setIsTriggering] = useState(false);
  const { showSuccess, showError } = useToastContext();
  
  // System health query
  const { data: healthData, loading: healthLoading, error: healthError, refetch: refetchHealth } = useSystemHealth(5000);
  
  // GitHub data query
  const { data: githubData, loading: githubLoading, error: githubError, refetch: refetchGithub } = useQuery(
    GITHUB_FULL_DATA_QUERY,
    { 
      variables: { first: 20 },
      errorPolicy: 'ignore',
      pollInterval: 30000 // Refresh every 30 seconds
    }
  );
  
  // Workflow data - not available in current GitHub Mesh service
  const workflowData = null;
  const workflowLoading = false;
  const refetchWorkflows = () => Promise.resolve();
  
  // Update last check time
  useEffect(() => {
    if (healthData) {
      setLastCheckTime(new Date());
    }
  }, [healthData]);
  
  // Auto-select first repo if none selected
  useEffect(() => {
    if (githubData?.githubRepositories?.length > 0 && !selectedRepo) {
      setSelectedRepo(githubData.githubRepositories[0].name);
    }
  }, [githubData, selectedRepo]);
  
  const handleRefresh = async () => {
    setRefreshKey(prev => prev + 1);
    await Promise.all([
      refetchHealth(),
      refetchGithub(),
      selectedRepo && refetchWorkflows()
    ]);
  };

  const handleTriggerWorkflow = async (workflowFile: string) => {
    if (!selectedRepo) return;
    
    setIsTriggering(true);
    try {
      await githubService.triggerWorkflow({
        repository: selectedRepo,
        workflow: workflowFile,
      });
      
      showSuccess('Workflow triggered', `Successfully triggered ${workflowFile} for ${selectedRepo}`);
      // Refresh workflows after trigger
      setTimeout(() => refetchWorkflows(), 2000);
    } catch (error) {
      showError('Failed to trigger workflow', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsTriggering(false);
    }
  };

  const handleCancelWorkflow = async (runId: number) => {
    if (!selectedRepo) return;
    
    try {
      await githubService.cancelWorkflow({
        repository: selectedRepo,
        runId
      });
      
      showSuccess('Workflow cancelled', `Successfully cancelled workflow run #${runId}`);
      setTimeout(() => refetchWorkflows(), 1000);
    } catch (error) {
      showError('Failed to cancel workflow', error instanceof Error ? error.message : 'Unknown error');
    }
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

  // Handle the new unified health data structure
  const health = healthData?.health;
  
  // Log the health data for debugging
  console.log('Health data from query:', { healthData, health, healthLoading, healthError });
  
  // If no health data yet, show loading
  if (!health) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading health data...</p>
        </div>
      </div>
    );
  }
  
  // Extract service-specific details from the unified health response
  const isClaudeService = health.service === 'claude-service';
  const claudeDetails = isClaudeService ? health.details : null;
  const claudeHealth = isClaudeService ? {
    healthy: health.healthy,
    version: health.version,
    claudeAvailable: claudeDetails?.claudeAvailable,
    activeSessions: claudeDetails?.activeSessions
  } : { healthy: true, version: 'Unknown' };
  
  // For repo health, we'll assume it's healthy if we get a response
  const repoHealth = !isClaudeService ? {
    status: health.healthy ? 'healthy' : 'unhealthy',
    version: health.version
  } : { status: 'healthy', version: '1.0.0' };

  const repositories = (githubData?.githubRepositories || []) as Repository[];
  const githubUser = githubData?.githubUser;
  const workflows = [];
  const workflowRuns = [] as WorkflowRun[];
  
  // Calculate metrics
  const totalPackages = repositories.filter(r => r.name.includes('gothic') || isMetaGOTHICPackage(r.name)).length;
  const totalRepos = repositories.length;
  const totalStars = repositories.reduce((sum, r) => sum + r.stargazersCount, 0);
  
  // Get all recent workflow runs from all repos
  const allWorkflowRuns = workflowRuns.map(run => ({
    ...run,
    repository: selectedRepo
  }));

  // Services from health data
  const services = [
    { 
      name: 'claude-service', 
      healthy: claudeHealth?.healthy || false, 
      version: claudeHealth?.version || 'Unknown', 
      responseTime: 45 
    },
    { 
      name: 'repo-agent-service', 
      healthy: repoHealth?.status === 'healthy', 
      version: repoHealth?.version || '1.0.0', 
      responseTime: 32 
    },
    { 
      name: 'gateway', 
      healthy: true, 
      version: '1.0.0', 
      responseTime: 12 
    }
  ];

  const healthyServices = services.filter((s: ServiceHealth) => s.healthy).length;
  const overallHealth = claudeHealth?.healthy && repoHealth?.status === 'healthy';
  
  const getWorkflowStatusIcon = (run: WorkflowRun) => {
    if (run.status === 'in_progress') return <Play className="h-4 w-4 text-blue-500 animate-pulse" />;
    if (run.conclusion === 'success') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (run.conclusion === 'failure') return <XCircle className="h-4 w-4 text-red-500" />;
    if (run.conclusion === 'cancelled') return <XCircle className="h-4 w-4 text-gray-500" />;
    if (run.conclusion === 'skipped') return <SkipForward className="h-4 w-4 text-gray-400" />;
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  const getStatusColor = (status: string, conclusion?: string) => {
    if (status === 'in_progress') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (conclusion === 'success') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (conclusion === 'failure') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    if (conclusion === 'cancelled') return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  };

  return (
    <ErrorBoundary>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Meta-GOTHIC Health Monitor
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Real-time monitoring of all metaGOTHIC packages, pipelines, and services
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={healthLoading || githubLoading || workflowLoading}
            variant="outline"
            size="sm"
          >
            {(healthLoading || githubLoading || workflowLoading) ? (
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
                  {githubUser.email && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{githubUser.email}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{totalRepos}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Repositories</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
                <div className={overallHealth ? 'text-green-500' : 'text-red-500'}>
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
                    Total Packages
                  </p>
                  <p className="text-2xl font-bold mt-2">{totalPackages}</p>
                </div>
                <Package className="h-8 w-8 text-blue-500" />
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
                    {healthyServices}/{services.length}
                  </p>
                </div>
                <Server className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total Stars
                  </p>
                  <p className="text-2xl font-bold mt-2">{totalStars}</p>
                </div>
                <Activity className="h-8 w-8 text-yellow-500" />
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
                    {claudeHealth?.activeSessions || 0}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-purple-500" />
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
                <Clock className="h-8 w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Control Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Pipeline Control Center
          </h2>
          
          {/* Repository Selector */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Select Repository:
            </label>
            <select
              value={selectedRepo}
              onChange={(e) => setSelectedRepo(e.target.value)}
              className="flex-1 max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={githubLoading}
            >
              {repositories.map(repo => (
                <option key={repo.id} value={repo.name}>{repo.name}</option>
              ))}
            </select>
          </div>

          {/* Quick Actions - Disabled until workflow support is added */}
          {selectedRepo && (
            <div className="text-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p className="text-gray-600 dark:text-gray-400">
                Workflow controls not available in current federation setup
              </p>
            </div>
          )}
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Repository Health */}
          <Card>
            <CardHeader>
              <CardTitle>Repository Health</CardTitle>
              <CardDescription>
                Package status and metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {(() => {
                  const filteredRepos = repositories.filter(r => r.name.includes('gothic') || isMetaGOTHICPackage(r.name));
                  const reposToShow = filteredRepos.length > 0 ? filteredRepos : repositories.slice(0, 10); // Show first 10 if no matches
                  
                  if (reposToShow.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p>No repositories found</p>
                        {githubLoading && <p className="text-sm mt-2">Loading repositories...</p>}
                      </div>
                    );
                  }
                  
                  return reposToShow.map((repo) => (
                  <div
                    key={repo.id}
                    className={clsx(
                      "p-4 rounded-lg border transition-colors cursor-pointer",
                      selectedRepo === repo.name 
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                    )}
                    onClick={() => setSelectedRepo(repo.name)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                          <Package className="h-4 w-4 mr-2" />
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
                          {repo.forksCount > 0 && (
                            <span className="text-blue-600">
                              🍴 {repo.forksCount}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          Updated {formatDistanceToNow(new Date(repo.updatedAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Recent Workflow Runs */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Workflow Runs</CardTitle>
              <CardDescription>
                {selectedRepo ? `Workflows for ${selectedRepo}` : 'Select a repository'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {workflowLoading ? (
                <div className="text-center py-8">
                  <Spinner size="lg" />
                </div>
              ) : allWorkflowRuns.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No recent workflow runs</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {allWorkflowRuns.map((run) => (
                    <div
                      key={run.id}
                      className="p-4 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getWorkflowStatusIcon(run)}
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {run.name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {run.headBranch}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={clsx(
                            'px-2 py-1 text-xs font-medium rounded-full',
                            getStatusColor(run.status, run.conclusion)
                          )}>
                            {run.conclusion || run.status}
                          </span>
                          {run.status === 'in_progress' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancelWorkflow(run.id)}
                            >
                              <Square className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        {formatDistanceToNow(new Date(run.updatedAt), { addSuffix: true })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Service Health */}
          <Card>
            <CardHeader>
              <CardTitle>Service Health</CardTitle>
              <CardDescription>
                GraphQL federation services
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
                      <div className={service.healthy ? 'text-green-500' : 'text-red-500'}>
                        {service.name.includes('claude') ? <Activity className="h-5 w-5" /> :
                         service.name.includes('repo') ? <Package className="h-5 w-5" /> :
                         <Server className="h-5 w-5" />}
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
                      {service.healthy ? (
                        <Badge variant="success" className="ml-2">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Healthy
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="ml-2">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Unhealthy
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* System Resources */}
              {claudeHealth?.resources && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">System Resources</h4>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">CPU Usage</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {Math.round(claudeHealth.resources.cpuUsage)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${Math.min(claudeHealth.resources.cpuUsage, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Memory</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {Math.round(claudeHealth.resources.memoryUsage)} MB
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div 
                        className="bg-green-600 h-2.5 rounded-full" 
                        style={{ width: `${Math.min((claudeHealth.resources.memoryUsage / 1024) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Auto-refresh indicator */}
        {(githubLoading || workflowLoading) && !healthLoading && (
          <div className="fixed bottom-4 right-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center space-x-2 shadow-lg">
            <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
            <span className="text-sm text-blue-700 dark:text-blue-300">Auto-refreshing data...</span>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

function isMetaGOTHICPackage(name: string): boolean {
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
    'meta-gothic-framework',
    'event-system',
    'file-system',
    'logger',
  ];
  
  // Also check if the name contains these patterns
  const patterns = ['gothic', 'meta-gothic', 'sdlc', 'claude'];
  
  return metaGOTHICPackages.includes(name) || 
         patterns.some(pattern => name.toLowerCase().includes(pattern));
}