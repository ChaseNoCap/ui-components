import { gql } from '@apollo/client';

// ============================================
// Fragments
// ============================================

export const GIT_FILE_FRAGMENT = gql`
  fragment GitFileInfo on FileStatus {
    path
    status
    isStaged
  }
`;

export const CLAUDE_SESSION_FRAGMENT = gql`
  fragment ClaudeSessionInfo on ClaudeSession {
    id
    status
    workingDirectory
    createdAt
  }
`;

export const AGENT_RUN_FRAGMENT = gql`
  fragment AgentRunInfo on AgentRun {
    id
    repository
    status
    startedAt
    completedAt
    duration
    retryCount
    parentRunId
  }
`;

// ============================================
// Queries
// ============================================

export const SYSTEM_HEALTH_QUERY = gql`
  query SystemHealth {
    health {
      healthy
      version
      claudeAvailable
      claudeVersion
      activeSessions
      resources {
        memoryUsage
        cpuUsage
        activeProcesses
      }
    }
  }
`;

export const GIT_STATUS_QUERY = gql`
  ${GIT_FILE_FRAGMENT}
  query GitStatus($path: String!) {
    gitStatus(path: $path) {
      branch
      isDirty
      ahead
      behind
      files {
        ...GitFileInfo
      }
    }
  }
`;

export const REPOSITORY_DETAILS_QUERY = gql`
  query RepositoryDetails($path: String!) {
    repositoryDetails(path: $path) {
      path
      name
      status {
        branch
        isDirty
        ahead
        behind
      }
      lastCommit {
        hash
        message
        author
        date
      }
    }
  }
`;

export const SCAN_ALL_REPOSITORIES_QUERY = gql`
  query ScanAllRepositories {
    scanAllRepositories {
      path
      name
      uncommittedCount
    }
  }
`;

export const CLAUDE_SESSIONS_QUERY = gql`
  ${CLAUDE_SESSION_FRAGMENT}
  query ClaudeSessions {
    sessions {
      ...ClaudeSessionInfo
    }
  }
`;

export const CLAUDE_SESSION_QUERY = gql`
  ${CLAUDE_SESSION_FRAGMENT}
  query ClaudeSession($id: ID!) {
    session(id: $id) {
      ...ClaudeSessionInfo
      history {
        timestamp
        prompt
        response
        executionTime
        success
      }
    }
  }
`;

export const AGENT_RUNS_QUERY = gql`
  ${AGENT_RUN_FRAGMENT}
  query AgentRuns(
    $status: RunStatus
    $repository: String
    $startDate: String
    $endDate: String
    $limit: Int
    $offset: Int
  ) {
    agentRuns(
      status: $status
      repository: $repository
      startDate: $startDate
      endDate: $endDate
      limit: $limit
      offset: $offset
    ) {
      runs {
        ...AgentRunInfo
        input {
          prompt
          diff
          recentCommits
          model
          temperature
        }
        output {
          message
          confidence
          reasoning
          rawResponse
          tokensUsed
        }
        error {
          code
          message
          stackTrace
          recoverable
        }
      }
      total
    }
  }
`;

export const RUN_STATISTICS_QUERY = gql`
  query RunStatistics {
    runStatistics {
      total
      byStatus {
        QUEUED
        RUNNING
        SUCCESS
        FAILED
        CANCELLED
        RETRYING
      }
      byRepository {
        repository
        count
      }
      averageDuration
      successRate
    }
  }
`;

// ============================================
// Mutations
// ============================================

export const EXECUTE_COMMAND_MUTATION = gql`
  mutation ExecuteCommand($input: Claude_ExecuteInput!) {
    executeCommand(input: $input) {
      sessionId
      success
      error
    }
  }
`;

export const KILL_SESSION_MUTATION = gql`
  mutation KillSession($id: ID!) {
    killSession(id: $id)
  }
`;

export const COMMIT_CHANGES_MUTATION = gql`
  mutation CommitChanges($input: Repo_CommitInput!) {
    commitChanges(input: $input) {
      success
      hash
      message
      error
      filesCommitted
      isClean
      remainingFiles
    }
  }
`;

export const BATCH_COMMIT_MUTATION = gql`
  mutation BatchCommit($input: Repo_BatchCommitInput!) {
    batchCommit(input: $input) {
      totalRepositories
      successCount
      results {
        success
        commitHash
        error
        repository
        committedFiles
        isClean
        remainingFiles
      }
    }
  }
`;

export const GENERATE_COMMIT_MESSAGES_MUTATION = gql`
  mutation GenerateCommitMessages($input: Claude_BatchCommitMessageInput!) {
    generateCommitMessages(input: $input) {
      totalRepositories
      successCount
      results {
        repositoryPath
        repositoryName
        success
        message
        error
        confidence
        commitType
      }
      totalTokenUsage {
        inputTokens
        outputTokens
        estimatedCost
      }
      executionTime
    }
  }
`;

export const RETRY_AGENT_RUN_MUTATION = gql`
  ${AGENT_RUN_FRAGMENT}
  mutation RetryAgentRun($runId: ID!) {
    retryAgentRun(runId: $runId) {
      ...AgentRunInfo
    }
  }
`;

export const RETRY_FAILED_RUNS_MUTATION = gql`
  ${AGENT_RUN_FRAGMENT}
  mutation RetryFailedRuns($runIds: [ID!]!) {
    retryFailedRuns(runIds: $runIds) {
      ...AgentRunInfo
    }
  }
`;

export const EXECUTE_GIT_COMMAND_MUTATION = gql`
  mutation ExecuteGitCommand($input: Repo_GitCommandInput!) {
    executeGitCommand(input: $input) {
      success
      output
      error
    }
  }
`;

// ============================================
// Subscriptions
// ============================================

export const COMMAND_OUTPUT_SUBSCRIPTION = gql`
  subscription CommandOutput($sessionId: ID!) {
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

export const AGENT_RUN_PROGRESS_SUBSCRIPTION = gql`
  subscription AgentRunProgress($runId: ID!) {
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

export const BATCH_PROGRESS_SUBSCRIPTION = gql`
  subscription BatchProgress($batchId: ID!) {
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
        isComplete
      }
      estimatedTimeRemaining
      startTime
      isComplete
    }
  }
`;