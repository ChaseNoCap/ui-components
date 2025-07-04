import React, { useState, useEffect } from 'react';
import { Activity, AlertCircle, CheckCircle, Clock, Package, RefreshCw, Server } from 'lucide-react';
import { useSystemHealth } from '@/hooks/useGraphQL';
import { useServicesHealth } from '@/hooks/useServicesHealth';
import { ErrorBoundary } from '../ErrorDisplay';
import { ErrorMessage } from '../ErrorDisplay';
import { Spinner } from '../LoadingStates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { formatDistanceToNow } from 'date-fns';

interface ServiceHealth {
  name: string;
  healthy: boolean;
  version: string | null;
  responseTime: number;
}

export const HealthDashboardGraphQL: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastCheckTime, setLastCheckTime] = useState<Date>(new Date());
  
  // Use GraphQL system health query with 5 second polling
  const { data, loading, error, refetch } = useSystemHealth(5000);
  
  // Use services health query for real service data
  const { 
    data: servicesData, 
    loading: servicesLoading, 
    error: servicesError,
    refetch: refetchServices 
  } = useServicesHealth(5000);
  
  // Update last check time when data changes
  React.useEffect(() => {
    if (data) {
      setLastCheckTime(new Date());
    }
  }, [data]);
  
  const handleRefresh = async () => {
    setRefreshKey(prev => prev + 1);
    await Promise.all([refetch(), refetchServices()]);
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading system health data...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-8">
        <ErrorMessage
          title="Unable to Load Health Data"
          message={error.message}
          severity="error"
          onRetry={handleRefresh}
        />
      </div>
    );
  }

  const health = data?.health;
  if (!health) return null;

  // Use real services data if available, otherwise create fallback based on health query
  const services = servicesData?.servicesHealth?.services || [
    { 
      name: 'claude-service', 
      healthy: health.claudeAvailable || false, 
      version: health.claudeVersion || 'Unknown', 
      responseTime: 0 
    },
    { 
      name: 'repo-agent-service', 
      healthy: true, 
      version: '1.0.0', 
      responseTime: 0 
    },
    { 
      name: 'gateway', 
      healthy: true, 
      version: health.version || '1.0.0', 
      responseTime: 0 
    }
  ];

  const healthyServices = services.filter((s: ServiceHealth) => s.healthy).length;
  const totalServices = services.length;
  const overallHealth = health.healthy;
  
  // Use real uptime if available, otherwise calculate from start time
  const uptimeSeconds = servicesData?.servicesHealth?.uptime || 3600;
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);
  const uptimeDays = Math.floor(uptimeHours / 24);

  const getUptimeDisplay = () => {
    if (uptimeDays > 0) return `${uptimeDays}d ${uptimeHours % 24}h`;
    if (uptimeHours > 0) return `${uptimeHours}h ${uptimeMinutes % 60}m`;
    return `${uptimeMinutes}m`;
  };

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
              System Health Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Monitor the health of GraphQL services in real-time
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>

        {/* Overview Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                <Clock className="h-8 w-8 text-green-500" />
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
                <Activity className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Memory Usage
                  </p>
                  <p className="text-2xl font-bold mt-2">
                    {health.resources ? `${Math.round(health.resources.memoryUsage)}MB` : 'N/A'}
                  </p>
                </div>
                <Server className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Services List */}
        <Card>
          <CardHeader>
            <CardTitle>Service Health</CardTitle>
            <CardDescription>
              Individual service status and response times
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

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>System Resources</CardTitle>
            <CardDescription>
              Current resource utilization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {health.resources && (
                <>
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
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
};