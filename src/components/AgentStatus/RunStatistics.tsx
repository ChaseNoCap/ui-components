import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Activity, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';

interface RunStatisticsData {
  total: number;
  byStatus: Record<string, number>;
  byRepository: Array<{ repository: string; count: number }>;
  averageDuration: number;
  successRate: number;
}

interface RunStatisticsProps {
  statistics: RunStatisticsData;
}

export const RunStatistics: React.FC<RunStatisticsProps> = ({ statistics }) => {
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const topRepositories = statistics.byRepository
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Total Runs */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Runs</p>
              <p className="text-2xl font-bold">{statistics.total}</p>
            </div>
            <Activity className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Success Rate */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
              <p className="text-2xl font-bold">{(statistics.successRate * 100).toFixed(1)}%</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-muted-foreground">
                    {statistics.byStatus.SUCCESS || 0}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-600" />
                  <span className="text-xs text-muted-foreground">
                    {statistics.byStatus.FAILED || 0}
                  </span>
                </div>
              </div>
            </div>
            <TrendingUp className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Average Duration */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg Duration</p>
              <p className="text-2xl font-bold">{formatDuration(statistics.averageDuration)}</p>
              <p className="text-xs text-muted-foreground mt-1">Per run</p>
            </div>
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Status Distribution */}
      <Card>
        <CardContent className="p-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Status Distribution</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs">Running</span>
                <Badge variant="secondary" className="text-xs">
                  {statistics.byStatus.RUNNING || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Queued</span>
                <Badge variant="default" className="text-xs">
                  {statistics.byStatus.QUEUED || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Retrying</span>
                <Badge variant="secondary" className="text-xs">
                  {statistics.byStatus.RETRYING || 0}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Repositories */}
      {topRepositories.length > 0 && (
        <Card className="col-span-full">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground mb-3">Top Repositories</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {topRepositories.map((repo) => (
                <div key={repo.repository} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-sm font-medium truncate">{repo.repository}</span>
                  <Badge variant="outline" className="ml-2">{repo.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};