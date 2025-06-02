import { gql } from '@apollo/client';

// Claude Subscriptions
export const CLAUDE_OUTPUT_SUBSCRIPTION = gql`
  subscription WatchClaudeOutput($sessionId: ID!) {
    commandOutput(sessionId: $sessionId) {
      type
      content
      timestamp
    }
  }
`;

export const AGENT_RUN_PROGRESS_SUBSCRIPTION = gql`
  subscription WatchAgentRunProgress($runId: ID!) {
    agentRunProgress(runId: $runId) {
      runId
      status
      progress
      currentStep
      totalSteps
      estimatedTimeRemaining
    }
  }
`;

export const BATCH_PROGRESS_SUBSCRIPTION = gql`
  subscription WatchBatchProgress($batchId: ID!) {
    batchProgress(batchId: $batchId) {
      id
      totalItems
      completedItems
      currentItem
      percentage
      estimatedTimeRemaining
      status
      errors
    }
  }
`;