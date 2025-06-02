import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { useCallback } from 'react';
import {
  GIT_STATUS_QUERY,
  SCAN_ALL_REPOSITORIES_QUERY,
  SCAN_ALL_DETAILED_QUERY,
  CLAUDE_SESSIONS_QUERY,
  CLAUDE_HEALTH_QUERY,
} from '../graphql/queries';
import {
  COMMIT_CHANGES_MUTATION,
  GENERATE_COMMIT_MESSAGES_MUTATION,
  GENERATE_EXECUTIVE_SUMMARY_MUTATION,
  EXECUTE_CLAUDE_COMMAND_MUTATION,
} from '../graphql/mutations';
import {
  CLAUDE_OUTPUT_SUBSCRIPTION,
  BATCH_PROGRESS_SUBSCRIPTION,
} from '../graphql/subscriptions';

// Git Hooks
export function useGitStatus(path: string) {
  return useQuery(GIT_STATUS_QUERY, {
    variables: { path },
    skip: !path,
  });
}

export function useScanAllRepositories() {
  return useQuery(SCAN_ALL_REPOSITORIES_QUERY, {
    pollInterval: 30000, // Poll every 30 seconds
  });
}

export function useScanAllDetailed() {
  return useQuery(SCAN_ALL_DETAILED_QUERY, {
    fetchPolicy: 'network-only',
  });
}

// Claude Hooks
export function useClaudeSessions() {
  return useQuery(CLAUDE_SESSIONS_QUERY, {
    pollInterval: 5000, // Poll every 5 seconds
  });
}

export function useClaudeHealth() {
  return useQuery(CLAUDE_HEALTH_QUERY);
}

// Mutation Hooks
export function useCommitChanges() {
  const [commitChanges, result] = useMutation(COMMIT_CHANGES_MUTATION);
  
  const commit = useCallback(
    async (path: string, message: string, files?: string[]) => {
      return commitChanges({
        variables: {
          input: {
            path,
            message,
            files,
          },
        },
      });
    },
    [commitChanges]
  );

  return { commit, ...result };
}

export function useGenerateCommitMessages() {
  const [generateMessages, result] = useMutation(GENERATE_COMMIT_MESSAGES_MUTATION);
  
  const generate = useCallback(
    async (repositories: Array<{ path: string; diff: string; recentCommits: string[] }>) => {
      return generateMessages({
        variables: {
          input: {
            repositories,
            temperature: 0.3,
            maxTokens: 150,
          },
        },
      });
    },
    [generateMessages]
  );

  return { generate, ...result };
}

export function useGenerateExecutiveSummary() {
  const [generateSummary, result] = useMutation(GENERATE_EXECUTIVE_SUMMARY_MUTATION);
  
  const generate = useCallback(
    async (commitMessages: Array<{ repository: string; message: string }>) => {
      return generateSummary({
        variables: {
          input: {
            commitMessages,
            style: 'executive',
          },
        },
      });
    },
    [generateSummary]
  );

  return { generate, ...result };
}

export function useExecuteClaudeCommand() {
  const [executeCommand, result] = useMutation(EXECUTE_CLAUDE_COMMAND_MUTATION);
  
  const execute = useCallback(
    async (command: string, args: string[], projectPath: string) => {
      return executeCommand({
        variables: {
          input: {
            command,
            args,
            projectPath,
          },
        },
      });
    },
    [executeCommand]
  );

  return { execute, ...result };
}

// Subscription Hooks
export function useClaudeOutput(sessionId: string | null) {
  return useSubscription(CLAUDE_OUTPUT_SUBSCRIPTION, {
    variables: { sessionId },
    skip: !sessionId,
  });
}

export function useBatchProgress(batchId: string | null) {
  return useSubscription(BATCH_PROGRESS_SUBSCRIPTION, {
    variables: { batchId },
    skip: !batchId,
  });
}

// Helper hook for migrating from REST to GraphQL
export function useGraphQLMigration() {
  const gitStatus = useGitStatus;
  const scanRepos = useScanAllRepositories;
  const scanDetailed = useScanAllDetailed;
  const commitChanges = useCommitChanges;
  const generateCommitMessages = useGenerateCommitMessages;
  const generateSummary = useGenerateExecutiveSummary;

  return {
    // Git operations
    gitStatus,
    scanRepos,
    scanDetailed,
    commitChanges,
    
    // Claude operations
    generateCommitMessages,
    generateSummary,
    
    // Utilities
    isGraphQLAvailable: true, // Can be enhanced with actual health check
  };
}