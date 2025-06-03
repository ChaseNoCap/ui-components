import React from 'react';
import { useSystemHealth } from '../../hooks/useGraphQL';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';

export const SystemHealthMonitor: React.FC = () => {
  const { data, loading, error, refetch } = useSystemHealth(5000); // Poll every 5 seconds

  if (loading && !data) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading system health...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-red-500">
        <CardHeader>
          <CardTitle className="text-red-600">System Health Check Failed</CardTitle>
          <CardDescription>{error.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const health = data?.systemHealth;
  if (!health) return null;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CardTitle>System Health</CardTitle>
            {health.healthy ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
          </div>
          <Badge variant={health.healthy ? 'success' : 'destructive'}>
            {health.healthy ? 'Healthy' : 'Unhealthy'}
          </Badge>
        </div>
        <CardDescription>
          Uptime: {Math.floor(health.uptime / 60)} minutes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Services:
          </div>
          {health.services.map((service) => (
            <div key={service.name} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    service.healthy ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span className="text-sm font-medium">{service.name}</span>
                <span className="text-xs text-gray-500">v{service.version}</span>
              </div>
              <span className="text-xs text-gray-500">
                {service.responseTime}ms
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Last checked: {new Date(health.timestamp).toLocaleTimeString()}</span>
            <Button
              onClick={() => refetch()}
              variant="ghost"
              size="sm"
              className="h-6 px-2"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};