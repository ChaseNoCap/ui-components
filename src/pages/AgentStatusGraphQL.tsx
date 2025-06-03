import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { useToast } from '../components/Toast/useToast';
import { Loader2, RefreshCw, AlertCircle, CheckCircle, Clock, XCircle, RotateCcw } from 'lucide-react';
import { RunList } from '../components/AgentStatus/RunList';
import { RunDetails } from '../components/AgentStatus/RunDetails';
import { RunStatistics } from '../components/AgentStatus/RunStatistics';
import { formatDistanceToNow } from 'date-fns';
import { 
  useAgentRuns, 
  useRunStatistics, 
  useRetryAgentRun, 
  useRetryFailedRuns,
  useAgentRunProgress 
} from '../hooks/useGraphQL';
import { useSubscription, gql } from '@apollo/client';
import { AGENT_RUN_PROGRESS_SUBSCRIPTION } from '../graphql/operations';

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

const AgentStatusGraphQL: React.FC = () => {
  const { toast } = useToast();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RunStatus | 'ALL'>('ALL');
  const [repositoryFilter, setRepositoryFilter] = useState<string>('ALL');

  // GraphQL queries
  const { 
    data: runsData, 
    loading: runsLoading, 
    error: runsError, 
    refetch: refetchRuns 
  } = useAgentRuns({
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    repository: repositoryFilter !== 'ALL' ? repositoryFilter : undefined,
    limit: 50,
  });

  // Poll for updates if there are running jobs
  const hasRunningJobs = runs.some(run => 
    run.status === RunStatus.RUNNING || 
    run.status === RunStatus.QUEUED || 
    run.status === RunStatus.RETRYING
  );
  
  useEffect(() => {
    if (hasRunningJobs) {
      const interval = setInterval(() => {
        refetchRuns();
        refetchStats();
      }, 3000); // Poll every 3 seconds
      
      return () => clearInterval(interval);
    }
  }, [hasRunningJobs, refetchRuns, refetchStats]);

  const { 
    data: statsData, 
    loading: statsLoading, 
    refetch: refetchStats 
  } = useRunStatistics();

  // GraphQL mutations
  const { retry: retryRun } = useRetryAgentRun();
  const { retryBatch } = useRetryFailedRuns();

  // Extract runs from query data
  const runs = runsData?.agentRuns?.runs || [];
  const statistics = statsData?.runStatistics;

  // Select first run if none selected
  useEffect(() => {
    if (!selectedRunId && runs.length > 0) {
      setSelectedRunId(runs[0].id);
    }
  }, [runs, selectedRunId]);

  // Show error toast if query fails
  useEffect(() => {
    if (runsError) {
      toast({
        title: 'Error loading runs',
        description: runsError.message,
        variant: 'destructive',
      });
    }
  }, [runsError, toast]);

  const handleRefresh = async () => {
    try {
      await Promise.all([refetchRuns(), refetchStats()]);
      toast({
        title: 'Refreshed',
        description: 'Agent run data updated',
      });
    } catch (error) {
      toast({
        title: 'Refresh failed',
        description: 'Could not refresh data',
        variant: 'destructive',
      });
    }
  };

  const handleRetryRun = async (runId: string) => {
    try {
      const result = await retryRun(runId);
      
      if (result.data?.retryAgentRun) {
        const newRun = result.data.retryAgentRun;
        
        toast({
          title: 'Run retried',
          description: `Created new run ${newRun.id}`,
        });
        
        // Select the new run
        setSelectedRunId(newRun.id);
      }
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
      const result = await retryBatch(runIds);
      
      if (result.data?.retryFailedRuns) {
        toast({
          title: 'Batch retry complete',
          description: `Retried ${result.data.retryFailedRuns.length} runs`,
        });
      }
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

  // Subscribe to progress updates for running jobs
  const runningRuns = runs.filter(run => run.status === RunStatus.RUNNING);
  
  // Subscribe to progress for selected run if it's running
  const { progress: selectedRunProgress } = useAgentRunProgress(
    selectedRun?.status === RunStatus.RUNNING ? selectedRun.id : undefined
  );

  // Subscribe to all running runs for live updates
  useSubscription(
    gql`
      subscription AllAgentRunUpdates {
        allAgentRunUpdates {
          id
          status
          completedAt
          duration
          output {
            message
            confidence
            tokensUsed
          }
          error {
            code
            message
          }
        }
      }
    `,
    {
      onSubscriptionData: ({ subscriptionData }) => {
        if (subscriptionData.data?.allAgentRunUpdates) {
          // Refetch to update the list with new data
          refetchRuns();
          
          // If this is our selected run, we might want to show a toast
          const update = subscriptionData.data.allAgentRunUpdates;
          if (update.id === selectedRunId && update.status === RunStatus.SUCCESS) {
            toast({
              title: 'Run completed',
              description: `Run ${update.id} completed successfully`,
            });
          }
        }
      },
      skip: runningRuns.length === 0, // Only subscribe if there are running runs
    }
  );

  if (runsLoading && !runsData) {
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
            Monitor Claude agent runs and performance (GraphQL-powered)
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={runsLoading || statsLoading}
          size="sm"
        >
          {(runsLoading || statsLoading) ? (
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
                {runs.length} runs found (Total: {runsData?.agentRuns?.total || 0})
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
              progress={selectedRunProgress}
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

      {/* Failed Runs Batch Retry */}
      {statistics && statistics.byStatus.FAILED > 0 && (
        <div className="fixed bottom-4 right-4">
          <Button
            onClick={() => {
              const failedRunIds = runs
                .filter(run => run.status === RunStatus.FAILED)
                .map(run => run.id);
              handleBatchRetry(failedRunIds);
            }}
            variant="outline"
            className="shadow-lg"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry All Failed ({statistics.byStatus.FAILED})
          </Button>
        </div>
      )}
    </div>
  );
};

export default AgentStatusGraphQL;