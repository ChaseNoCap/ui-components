import { useQuery, useMutation, useSubscription, gql } from '@apollo/client';
import { useCallback, useEffect, useState } from 'react';
import {
  SYSTEM_HEALTH_QUERY,
  GIT_STATUS_QUERY,
  REPOSITORY_DETAILS_QUERY,
  SCAN_ALL_REPOSITORIES_QUERY,
  CLAUDE_SESSIONS_QUERY,
  // REPOSITORY_WITH_ANALYSIS_QUERY, // TODO: Add to operations.ts when schema supports it
  AGENT_RUNS_QUERY,
  RUN_STATISTICS_QUERY,
  EXECUTE_COMMAND_MUTATION,
  COMMIT_CHANGES_MUTATION,
  GENERATE_COMMIT_MESSAGES_MUTATION,
  RETRY_AGENT_RUN_MUTATION,
  RETRY_FAILED_RUNS_MUTATION,
  COMMAND_OUTPUT_SUBSCRIPTION,
  AGENT_RUN_PROGRESS_SUBSCRIPTION,
} from '../graphql/operations';

// ============================================
// Query Hooks
// ============================================

export const useSystemHealth = (pollInterval?: number) => {
  return useQuery(SYSTEM_HEALTH_QUERY, {
    pollInterval: pollInterval || 5000, // Default 5s polling
    notifyOnNetworkStatusChange: true,
  });
};

export const useGitStatus = (path: string, options?: { skip?: boolean; pollInterval?: number }) => {
  return useQuery(GIT_STATUS_QUERY, {
    variables: { path },
    skip: !path || options?.skip,
    pollInterval: options?.pollInterval,
    fetchPolicy: 'cache-and-network',
  });
};

export const useRepositoryDetails = (path: string) => {
  return useQuery(REPOSITORY_DETAILS_QUERY, {
    variables: { path },
    skip: !path,
  });
};

export const useScanAllRepositories = () => {
  return useQuery(SCAN_ALL_REPOSITORIES_QUERY, {
    fetchPolicy: 'network-only', // Always get fresh data
  });
};

export const useClaudeSessions = () => {
  return useQuery(CLAUDE_SESSIONS_QUERY, {
    pollInterval: 2000, // Poll for active sessions
  });
};

// TODO: Implement when repositoryWithAnalysis query is available in schema
// export const useRepositoryWithAnalysis = (path: string) => {
//   return useQuery(REPOSITORY_WITH_ANALYSIS_QUERY, {
//     variables: { path },
//     skip: !path,
//     fetchPolicy: 'cache-and-network',
//   });
// };

export const useAgentRuns = (filters?: {
  status?: string;
  repository?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) => {
  return useQuery(AGENT_RUNS_QUERY, {
    variables: filters,
    fetchPolicy: 'cache-and-network',
  });
};

export const useRunStatistics = () => {
  return useQuery(RUN_STATISTICS_QUERY, {
    fetchPolicy: 'network-only',
  });
};

export const useScanAllDetailed = () => {
  return useQuery(
    gql`
      query ScanAllDetailed {
        scanAllDetailed {
          repositories {
            name
            path
            status {
              branch
              isDirty
              ahead
              behind
              hasRemote
              files {
                path
                status
                statusDescription
                isStaged
              }
              stashes {
                index
                message
                timestamp
              }
            }
            stagedDiff
            unstagedDiff
            recentCommits {
              hash
              message
              author
              authorEmail
              timestamp
            }
            remotes {
              name
              fetchUrl
              pushUrl
            }
            config {
              defaultBranch
              gitFlowEnabled
            }
          }
          statistics {
            totalRepositories
            dirtyRepositories
            staged
            modified
            added
            deleted
            renamed
            copied
            untracked
          }
          metadata {
            startTime
            endTime
            duration
            workspaceRoot
          }
        }
      }
    `,
    {
      fetchPolicy: 'network-only',
    }
  );
};

// ============================================
// Mutation Hooks
// ============================================

export const useExecuteCommand = () => {
  const [executeCommand, result] = useMutation(EXECUTE_COMMAND_MUTATION);
  
  const execute = useCallback(async (prompt: string, workingDirectory: string) => {
    return executeCommand({
      variables: {
        input: {
          prompt,
          workingDirectory,
        },
      },
    });
  }, [executeCommand]);
  
  return { execute, ...result };
};

export const useCommitChanges = () => {
  const [commitChanges, result] = useMutation(COMMIT_CHANGES_MUTATION);
  
  const commit = useCallback(async (path: string, message: string, files?: string[]) => {
    return commitChanges({
      variables: {
        input: {
          path,
          message,
          files,
        },
      },
      refetchQueries: [
        { query: GIT_STATUS_QUERY, variables: { path } },
        { query: REPOSITORY_DETAILS_QUERY, variables: { path } },
      ],
    });
  }, [commitChanges]);
  
  return { commit, ...result };
};

export const useGenerateCommitMessages = () => {
  const [generateCommitMessages, result] = useMutation(GENERATE_COMMIT_MESSAGES_MUTATION);
  
  const generate = useCallback(async (repositoryPaths: string[]) => {
    return generateCommitMessages({
      variables: { repositoryPaths },
    });
  }, [generateCommitMessages]);
  
  return { generate, ...result };
};

export const useRetryAgentRun = () => {
  const [retryAgentRun, result] = useMutation(RETRY_AGENT_RUN_MUTATION);
  
  const retry = useCallback(async (runId: string) => {
    return retryAgentRun({
      variables: { runId },
      refetchQueries: [
        { query: AGENT_RUNS_QUERY },
        { query: RUN_STATISTICS_QUERY },
      ],
    });
  }, [retryAgentRun]);
  
  return { retry, ...result };
};

export const useRetryFailedRuns = () => {
  const [retryFailedRuns, result] = useMutation(RETRY_FAILED_RUNS_MUTATION);
  
  const retryBatch = useCallback(async (runIds: string[]) => {
    return retryFailedRuns({
      variables: { runIds },
      refetchQueries: [
        { query: AGENT_RUNS_QUERY },
        { query: RUN_STATISTICS_QUERY },
      ],
    });
  }, [retryFailedRuns]);
  
  return { retryBatch, ...result };
};

// ============================================
// Subscription Hooks
// ============================================

export const useCommandOutput = (sessionId?: string) => {
  const [output, setOutput] = useState<Array<{
    type: string;
    data: string;
    timestamp: string;
  }>>([]);
  
  const { data, error, loading } = useSubscription(COMMAND_OUTPUT_SUBSCRIPTION, {
    variables: { sessionId },
    skip: !sessionId,
    onSubscriptionData: ({ subscriptionData }) => {
      if (subscriptionData.data?.commandOutput) {
        setOutput(prev => [...prev, subscriptionData.data.commandOutput]);
      }
    },
  });
  
  // Clear output when session changes
  useEffect(() => {
    setOutput([]);
  }, [sessionId]);
  
  return { output, error, loading };
};

export const useAgentRunProgress = (runId?: string) => {
  const [logs, setLogs] = useState<string[]>([]);
  
  const { data, error, loading } = useSubscription(AGENT_RUN_PROGRESS_SUBSCRIPTION, {
    variables: { runId },
    skip: !runId,
    onSubscriptionData: ({ subscriptionData }) => {
      if (subscriptionData.data?.agentRunProgress?.logs) {
        setLogs(subscriptionData.data.agentRunProgress.logs);
      }
    },
  });
  
  return {
    progress: data?.agentRunProgress,
    logs,
    error,
    loading,
  };
};

// ============================================
// Composite Hooks
// ============================================

export const useRepositoryDashboard = (path: string) => {
  const gitStatus = useGitStatus(path);
  const details = useRepositoryDetails(path);
  // TODO: Add analysis when repositoryWithAnalysis query is available
  // const analysis = useRepositoryWithAnalysis(path);
  
  return {
    gitStatus: gitStatus.data?.gitStatus,
    details: details.data?.repositoryDetails,
    analysis: null, // analysis.data?.repositoryWithAnalysis,
    loading: gitStatus.loading || details.loading, // || analysis.loading,
    error: gitStatus.error || details.error, // || analysis.error,
    refetch: async () => {
      await Promise.all([
        gitStatus.refetch(),
        details.refetch(),
        // analysis.refetch(),
      ]);
    },
  };
};

// ============================================
// Optimistic Response Helpers
// ============================================

export const useOptimisticCommit = () => {
  const { commit, ...result } = useCommitChanges();
  
  const optimisticCommit = useCallback(async (
    path: string, 
    message: string, 
    files?: string[]
  ) => {
    return commit(path, message, files).then(result => {
      // Optimistically update the UI
      if (result.data?.commitChanges.success) {
        // The cache will be updated by refetchQueries
      }
      return result;
    });
  }, [commit]);
  
  return { commit: optimisticCommit, ...result };
};