import { gql } from '@apollo/client';

// Mutation to generate commit messages
export const GENERATE_COMMIT_MESSAGES = gql`
  mutation GenerateCommitMessages($changes: String!) {
    generateCommitMessages(changes: $changes) {
      messages
      reasoning
    }
  }
`;

// Mutation to generate batch commit messages
export const GENERATE_BATCH_COMMIT_MESSAGES = gql`
  mutation GenerateBatchCommitMessages($repositories: [RepositoryChangesInput!]!) {
    generateBatchCommitMessages(repositories: $repositories) {
      repository
      message
      reasoning
    }
  }
`;

// Mutation to generate executive summary
export const GENERATE_EXECUTIVE_SUMMARY = gql`
  mutation GenerateExecutiveSummary($repositories: [RepositorySummaryInput!]!) {
    generateExecutiveSummary(repositories: $repositories) {
      summary
      highlights
      recommendations
    }
  }
`;

// Query to get agent runs
export const GET_AGENT_RUNS = gql`
  query GetAgentRuns($status: String, $limit: Int, $offset: Int) {
    agentRuns(status: $status, limit: $limit, offset: $offset) {
      id
      sessionId
      status
      input
      output
      error
      startedAt
      completedAt
      toolCalls
      duration
    }
  }
`;

// Query to get agent run statistics
export const GET_AGENT_RUN_STATISTICS = gql`
  query GetAgentRunStatistics {
    agentRunStatistics {
      total
      byStatus {
        status
        count
      }
      averageDuration
      successRate
    }
  }
`;

// Mutation to retry agent run
export const RETRY_AGENT_RUN = gql`
  mutation RetryAgentRun($runId: String!) {
    retryAgentRun(runId: $runId) {
      id
      status
      message
    }
  }
`;

// Mutation to retry batch agent runs
export const RETRY_BATCH_AGENT_RUNS = gql`
  mutation RetryBatchAgentRuns($runIds: [String!]!) {
    retryBatchAgentRuns(runIds: $runIds) {
      runId
      success
      message
      error
    }
  }
`;

// Mutation to execute Claude command
export const EXECUTE_CLAUDE_COMMAND = gql`
  mutation ExecuteCommand($input: ClaudeExecuteInput!) {
    executeCommand(input: $input) {
      sessionId
      success
      error
      initialResponse
      metadata {
        startTime
        pid
        estimatedTime
        flags
      }
    }
  }
`;

// Subscription for command output
export const COMMAND_OUTPUT_SUBSCRIPTION = gql`
  subscription OnCommandOutput($sessionId: ID!) {
    commandOutput(sessionId: $sessionId) {
      sessionId
      type
      content
      timestamp
      isFinal
      tokens
    }
  }
`;

// Subscription for agent run progress
export const AGENT_RUN_PROGRESS_SUBSCRIPTION = gql`
  subscription OnAgentRunProgress($runId: String!) {
    agentRunProgress(runId: $runId) {
      runId
      status
      progress
      currentStep
      totalSteps
      message
    }
  }
`;

// Note: Input types are defined in the schema and prefixed with service name in federation