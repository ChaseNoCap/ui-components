import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useToast } from '../components/Toast/useToast';
import { Loader2, RefreshCw, AlertCircle, CheckCircle, Clock, XCircle, RotateCcw } from 'lucide-react';
import { RunList } from '../components/AgentStatus/RunList';
import { RunDetails } from '../components/AgentStatus/RunDetails';
import { RunStatistics } from '../components/AgentStatus/RunStatistics';
import { formatDistanceToNow } from 'date-fns';

// Types matching GraphQL schema
interface AgentRun {
  id: string;
  repository: string;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  input: AgentInput;
  output?: AgentOutput;
  error?: RunError;
  retryCount: number;
  parentRunId?: string;
}

enum RunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  RETRYING = 'RETRYING',
}

interface AgentInput {
  prompt: string;
  diff: string;
  recentCommits: string[];
  model: string;
  temperature: number;
}

interface AgentOutput {
  message: string;
  confidence: number;
  reasoning?: string;
  rawResponse: string;
  tokensUsed: number;
}

interface RunError {
  code: string;
  message: string;
  stackTrace?: string;
  recoverable: boolean;
}

interface RunStatisticsData {
  total: number;
  byStatus: Record<RunStatus, number>;
  byRepository: Array<{ repository: string; count: number }>;
  averageDuration: number;
  successRate: number;
}

const AgentStatus: React.FC = () => {
  const { toast } = useToast();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [statistics, setStatistics] = useState<RunStatisticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<RunStatus | 'ALL'>('ALL');
  const [repositoryFilter, setRepositoryFilter] = useState<string>('ALL');

  // Load runs on mount
  useEffect(() => {
    loadRuns();
    loadStatistics();
  }, [statusFilter, repositoryFilter]);

  const loadRuns = async () => {
    try {
      setLoading(true);
      
      // TODO: Replace with GraphQL query
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (repositoryFilter !== 'ALL') params.append('repository', repositoryFilter);
      
      const response = await fetch(`http://localhost:3003/api/claude/runs?${params}`);
      if (!response.ok) throw new Error('Failed to load runs');
      
      const data = await response.json();
      setRuns(data.runs || []);
      
      // Select first run if none selected
      if (!selectedRunId && data.runs.length > 0) {
        setSelectedRunId(data.runs[0].id);
      }
    } catch (error) {
      console.error('Failed to load runs:', error);
      toast({
        title: 'Error loading runs',
        description: 'Failed to fetch agent run history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await fetch('http://localhost:3003/api/claude/runs/statistics');
      if (!response.ok) throw new Error('Failed to load statistics');
      
      const data = await response.json();
      setStatistics(data);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadRuns(), loadStatistics()]);
    setRefreshing(false);
    
    toast({
      title: 'Refreshed',
      description: 'Agent run data updated',
    });
  };

  const handleRetryRun = async (runId: string) => {
    try {
      const response = await fetch(`http://localhost:3003/api/claude/runs/${runId}/retry`, {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error('Failed to retry run');
      
      const newRun = await response.json();
      
      toast({
        title: 'Run retried',
        description: `Created new run ${newRun.id}`,
      });
      
      // Refresh runs
      await loadRuns();
      
      // Select the new run
      setSelectedRunId(newRun.id);
    } catch (error) {
      toast({
        title: 'Retry failed',
        description: 'Could not retry the run',
        variant: 'destructive',
      });
    }
  };

  const handleBatchRetry = async (runIds: string[]) => {
    try {
      const response = await fetch('http://localhost:3003/api/claude/runs/retry-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runIds }),
      });
      
      if (!response.ok) throw new Error('Failed to retry runs');
      
      const result = await response.json();
      
      toast({
        title: 'Batch retry complete',
        description: `Retried ${result.count} runs`,
      });
      
      await loadRuns();
    } catch (error) {
      toast({
        title: 'Batch retry failed',
        description: 'Could not retry selected runs',
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: RunStatus) => {
    switch (status) {
      case RunStatus.QUEUED:
        return <Clock className="h-4 w-4" />;
      case RunStatus.RUNNING:
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case RunStatus.SUCCESS:
        return <CheckCircle className="h-4 w-4" />;
      case RunStatus.FAILED:
        return <XCircle className="h-4 w-4" />;
      case RunStatus.CANCELLED:
        return <AlertCircle className="h-4 w-4" />;
      case RunStatus.RETRYING:
        return <RotateCcw className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: RunStatus) => {
    switch (status) {
      case RunStatus.QUEUED:
        return 'default';
      case RunStatus.RUNNING:
        return 'secondary';
      case RunStatus.SUCCESS:
        return 'success';
      case RunStatus.FAILED:
        return 'destructive';
      case RunStatus.CANCELLED:
        return 'warning';
      case RunStatus.RETRYING:
        return 'secondary';
    }
  };

  const selectedRun = runs.find(run => run.id === selectedRunId);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Agent Status</h1>
          <p className="text-muted-foreground mt-2">
            Monitor Claude agent runs and performance
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          size="sm"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {/* Statistics Overview */}
      {statistics && (
        <div className="mb-6">
          <RunStatistics statistics={statistics} />
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Run List */}
        <div className="col-span-4">
          <Card className="h-[calc(100vh-300px)]">
            <CardHeader>
              <CardTitle>Run History</CardTitle>
              <CardDescription>
                {runs.length} runs found
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <RunList
                runs={runs}
                selectedRunId={selectedRunId}
                onSelectRun={setSelectedRunId}
                onRetryRun={handleRetryRun}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                repositoryFilter={repositoryFilter}
                onRepositoryFilterChange={setRepositoryFilter}
              />
            </CardContent>
          </Card>
        </div>

        {/* Run Details */}
        <div className="col-span-8">
          {selectedRun ? (
            <RunDetails
              run={selectedRun}
              onRetry={() => handleRetryRun(selectedRun.id)}
            />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-96">
                <p className="text-muted-foreground">
                  Select a run to view details
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentStatus;