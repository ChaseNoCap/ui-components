import React from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { Clock, CheckCircle, XCircle, AlertCircle, Loader2, RotateCcw, Search } from 'lucide-react';

enum RunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  RETRYING = 'RETRYING',
}

interface AgentRun {
  id: string;
  repository: string;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  retryCount: number;
}

interface RunListProps {
  runs: AgentRun[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
  onRetryRun: (runId: string) => void;
  statusFilter: RunStatus | 'ALL';
  onStatusFilterChange: (status: RunStatus | 'ALL') => void;
  repositoryFilter: string;
  onRepositoryFilterChange: (repository: string) => void;
}

export const RunList: React.FC<RunListProps> = ({
  runs,
  selectedRunId,
  onSelectRun,
  onRetryRun,
  statusFilter,
  onStatusFilterChange,
  repositoryFilter,
  onRepositoryFilterChange,
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const getStatusIcon = (status: RunStatus) => {
    switch (status) {
      case RunStatus.QUEUED:
        return <Clock className="h-3 w-3" />;
      case RunStatus.RUNNING:
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case RunStatus.SUCCESS:
        return <CheckCircle className="h-3 w-3" />;
      case RunStatus.FAILED:
        return <XCircle className="h-3 w-3" />;
      case RunStatus.CANCELLED:
        return <AlertCircle className="h-3 w-3" />;
      case RunStatus.RETRYING:
        return <RotateCcw className="h-3 w-3" />;
    }
  };

  const getStatusColor = (status: RunStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case RunStatus.QUEUED:
        return 'default';
      case RunStatus.RUNNING:
        return 'secondary';
      case RunStatus.SUCCESS:
        return 'outline';
      case RunStatus.FAILED:
        return 'destructive';
      case RunStatus.CANCELLED:
        return 'secondary';
      case RunStatus.RETRYING:
        return 'secondary';
      default:
        return 'default';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Get unique repositories
  const repositories = Array.from(new Set(runs.map(run => run.repository))).sort();

  // Filter runs
  const filteredRuns = runs.filter(run => {
    if (searchTerm && !run.repository.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search repositories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Status</Label>
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value as RunStatus | 'ALL')}
              className="w-full mt-1 px-3 py-2 text-sm border rounded-md"
            >
              <option value="ALL">All Statuses</option>
              {Object.values(RunStatus).map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          
          <div>
            <Label className="text-xs">Repository</Label>
            <select
              value={repositoryFilter}
              onChange={(e) => onRepositoryFilterChange(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border rounded-md"
            >
              <option value="ALL">All Repositories</option>
              {repositories.map(repo => (
                <option key={repo} value={repo}>{repo}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Run List */}
      <div className="flex-1 overflow-y-auto">
        {filteredRuns.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No runs found
          </div>
        ) : (
          <div className="divide-y">
            {filteredRuns.map((run) => (
              <div
                key={run.id}
                onClick={() => onSelectRun(run.id)}
                className={clsx(
                  'p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
                  selectedRunId === run.id && 'bg-gray-50 dark:bg-gray-800'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusColor(run.status)} className="flex items-center gap-1">
                        {getStatusIcon(run.status)}
                        <span className="text-xs">{run.status}</span>
                      </Badge>
                      {run.retryCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Retry #{run.retryCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium mt-1 truncate">
                      {run.repository}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
                      {run.duration && ` • ${formatDuration(run.duration)}`}
                    </p>
                  </div>
                  
                  {run.status === RunStatus.FAILED && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetryRun(run.id);
                      }}
                      className="flex-shrink-0"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};