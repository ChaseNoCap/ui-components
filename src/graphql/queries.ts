import { gql } from '@apollo/client';

// Git Queries
export const GIT_STATUS_QUERY = gql`
  query GetGitStatus($path: String!) {
    gitStatus(path: $path) {
      branch
      ahead
      behind
      files {
        path
        status
        staged
      }
      hasChanges
      workingDirectory
    }
  }
`;

export const SCAN_ALL_REPOSITORIES_QUERY = gql`
  query ScanAllRepositories {
    scanAllRepositories {
      path
      name
      hasChanges
      branch
      uncommittedCount
      lastCommit {
        hash
        message
        date
      }
    }
  }
`;

export const SCAN_ALL_DETAILED_QUERY = gql`
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
          isBare
          isShallow
        }
      }
      statistics {
        totalRepositories
        dirtyRepositories
        totalUncommittedFiles
        totalAdditions
        totalDeletions
        changesByType {
          modified
          added
          deleted
          renamed
          untracked
        }
      }
      metadata {
        startTime
        endTime
        duration
        workspaceRoot
      }
    }
  }
`;

export const REPOSITORY_DETAILS_QUERY = gql`
  query GetRepositoryDetails($path: String!) {
    repositoryDetails(path: $path) {
      name
      path
      currentBranch
      remoteUrl
      lastCommit {
        hash
        message
        author
        date
      }
      stats {
        totalCommits
        contributors
        branches
      }
      submodules {
        name
        path
        url
        currentCommit
        status
      }
    }
  }
`;

// Claude Queries
export const CLAUDE_SESSIONS_QUERY = gql`
  query GetClaudeSessions {
    sessions {
      id
      status
      pid
      createdAt
      command
      args
      projectPath
    }
  }
`;

export const CLAUDE_HEALTH_QUERY = gql`
  query GetClaudeHealth {
    health {
      status
      version
      uptime
      claudeAvailable
    }
  }
`;

export const PERFORMANCE_METRICS_QUERY = gql`
  query GetPerformanceMetrics {
    performanceMetrics {
      averageResponseTime
      requestsPerMinute
      errorRate
      queueDepth
      parallelComparison {
        parallelTime
        sequentialTime
        improvement
      }
    }
  }
`;

// Combined Health Check
export const GATEWAY_HEALTH_QUERY = gql`
  query GetGatewayHealth {
    health {
      status
      version
      uptime
    }
  }
`;