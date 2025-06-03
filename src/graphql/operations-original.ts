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
    systemHealth {
      healthy
      services {
        name
        healthy
        version
        responseTime
      }
      uptime
      timestamp
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
      currentBranch
      branches
      remotes
      lastCommit {
        hash
        message
        author
        date
      }
      stats {
        totalCommits
        totalBranches
        totalTags
      }
    }
  }
`;

export const SCAN_ALL_REPOSITORIES_QUERY = gql`
  query ScanAllRepositories {
    scanAllRepositories {
      path
      name
      isGitRepo
      hasUncommittedChanges
      currentBranch
      lastCommitDate
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
      logs
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

export const REPOSITORY_WITH_ANALYSIS_QUERY = gql`
  ${GIT_FILE_FRAGMENT}
  ${CLAUDE_SESSION_FRAGMENT}
  ${AGENT_RUN_FRAGMENT}
  query RepositoryWithAnalysis($path: String!) {
    repositoryWithAnalysis(path: $path) {
      gitStatus {
        branch
        isDirty
        files {
          ...GitFileInfo
        }
      }
      activeSessions {
        ...ClaudeSessionInfo
      }
      recentAnalyses {
        ...AgentRunInfo
      }
    }
  }
`;

// ============================================
// Mutations
// ============================================

export const EXECUTE_COMMAND_MUTATION = gql`
  mutation ExecuteCommand($input: ClaudeExecuteInput!) {
    executeCommand(input: $input) {
      sessionId
      success
      error
    }
  }
`;

export const KILL_SESSION_MUTATION = gql`
  mutation KillSession($sessionId: ID!) {
    killSession(sessionId: $sessionId) {
      success
      message
    }
  }
`;

export const COMMIT_CHANGES_MUTATION = gql`
  mutation CommitChanges($input: CommitInput!) {
    commitChanges(input: $input) {
      success
      commit {
        hash
        message
        author
        date
      }
      error
    }
  }
`;

export const BATCH_COMMIT_MUTATION = gql`
  mutation BatchCommit($input: BatchCommitInput!) {
    batchCommit(input: $input) {
      success
      commits {
        repositoryPath
        commit {
          hash
          message
        }
        error
      }
    }
  }
`;

export const GENERATE_COMMIT_MESSAGES_MUTATION = gql`
  mutation GenerateCommitMessages($repositoryPaths: [String!]!) {
    generateCommitMessages(repositoryPaths: $repositoryPaths) {
      success
      messages {
        repositoryPath
        suggestedMessage
        summary
        error
      }
    }
  }
`;

export const CREATE_AGENT_RUN_MUTATION = gql`
  ${AGENT_RUN_FRAGMENT}
  mutation CreateAgentRun($input: CreateAgentRunInput!) {
    createAgentRun(input: $input) {
      ...AgentRunInfo
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
  mutation ExecuteGitCommand($path: String!, $command: String!) {
    executeGitCommand(path: $path, command: $command) {
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
      type
      data
      timestamp
    }
  }
`;

export const AGENT_RUN_PROGRESS_SUBSCRIPTION = gql`
  subscription AgentRunProgress($runId: ID!) {
    agentRunProgress(runId: $runId) {
      id
      status
      progress
      currentStep
      totalSteps
      logs
    }
  }
`;

export const BATCH_PROGRESS_SUBSCRIPTION = gql`
  subscription BatchProgress($batchId: ID!) {
    batchProgress(batchId: $batchId) {
      batchId
      totalRepositories
      completedRepositories
      currentRepository
      errors
    }
  }
`;