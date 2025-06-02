import React, { useEffect, useState } from 'react';
import { useSubscription, gql } from '@apollo/client';
import { ProgressBar, BatchProgress } from './ProgressBar';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { X, AlertCircle } from 'lucide-react';

const AGENT_RUN_PROGRESS_SUBSCRIPTION = gql`
  subscription OnAgentRunProgress($runId: ID!) {
    agentRunProgress(runId: $runId) {
      runId
      repository
      stage
      percentage
      estimatedTimeRemaining
      currentOperation
      timestamp
      isComplete
      error
    }
  }
`;

const BATCH_PROGRESS_SUBSCRIPTION = gql`
  subscription OnBatchProgress($batchId: ID!) {
    batchProgress(batchId: $batchId) {
      batchId
      totalOperations
      completedOperations
      failedOperations
      overallPercentage
      runProgress {
        runId
        repository
        stage
        percentage
        currentOperation
        isComplete
      }
      estimatedTimeRemaining
      startTime
      isComplete
    }
  }
`;

interface RunProgressTrackerProps {
  runId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

export function RunProgressTracker({ 
  runId, 
  onComplete, 
  onError,
  onCancel 
}: RunProgressTrackerProps) {
  const { data, loading, error } = useSubscription(AGENT_RUN_PROGRESS_SUBSCRIPTION, {
    variables: { runId }
  });

  useEffect(() => {
    if (data?.agentRunProgress?.isComplete) {
      if (data.agentRunProgress.error) {
        onError?.(data.agentRunProgress.error);
      } else {
        onComplete?.();
      }
    }
  }, [data, onComplete, onError]);

  if (loading || !data) {
    return (
      <Card className="p-4">
        <ProgressBar percentage={0} label="Initializing..." />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4 border-red-200 bg-red-50">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Error tracking progress: {error.message}</span>
        </div>
      </Card>
    );
  }

  const progress = data.agentRunProgress;

  return (
    <Card className="p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-medium text-sm">{progress.repository}</h4>
          {progress.currentOperation && (
            <p className="text-xs text-gray-500 mt-1">{progress.currentOperation}</p>
          )}
        </div>
        {onCancel && !progress.isComplete && (
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      <ProgressBar
        percentage={progress.percentage}
        stage={progress.stage}
        estimatedTimeRemaining={progress.estimatedTimeRemaining}
        showPercentage={true}
      />
      
      {progress.error && (
        <div className="mt-2 text-sm text-red-600">
          Error: {progress.error}
        </div>
      )}
    </Card>
  );
}

interface BatchProgressTrackerProps {
  batchId: string;
  onComplete?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function BatchProgressTracker({ 
  batchId, 
  onComplete,
  onCancel,
  className = ''
}: BatchProgressTrackerProps) {
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const { data, loading, error } = useSubscription(BATCH_PROGRESS_SUBSCRIPTION, {
    variables: { batchId }
  });

  useEffect(() => {
    if (data?.batchProgress?.isComplete) {
      onComplete?.();
    }
  }, [data, onComplete]);

  const toggleRunExpansion = (runId: string) => {
    setExpandedRuns(prev => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  };

  if (loading || !data) {
    return (
      <div className={className}>
        <BatchProgress
          totalOperations={0}
          completedOperations={0}
          failedOperations={0}
          overallPercentage={0}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className} p-4 border border-red-200 bg-red-50 rounded-lg`}>
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Error tracking batch progress: {error.message}</span>
        </div>
      </div>
    );
  }

  const batch = data.batchProgress;

  return (
    <div className={className}>
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">Batch Progress</h3>
          {onCancel && !batch.isComplete && (
            <button
              onClick={onCancel}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel All
            </button>
          )}
        </div>
        
        <BatchProgress
          totalOperations={batch.totalOperations}
          completedOperations={batch.completedOperations}
          failedOperations={batch.failedOperations}
          overallPercentage={batch.overallPercentage}
          estimatedTimeRemaining={batch.estimatedTimeRemaining}
        />
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">Individual Progress</h4>
        {batch.runProgress.map((run: any) => (
          <div key={run.runId} className="border rounded-lg p-3">
            <div 
              className="flex justify-between items-center cursor-pointer"
              onClick={() => toggleRunExpansion(run.runId)}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{run.repository}</span>
                <Badge 
                  variant={run.isComplete ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {run.stage}
                </Badge>
              </div>
              <span className="text-sm text-gray-500">{run.percentage}%</span>
            </div>
            
            {expandedRuns.has(run.runId) && (
              <div className="mt-2">
                <ProgressBar
                  percentage={run.percentage}
                  stage={run.currentOperation}
                  showPercentage={false}
                  className="mt-2"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}