import { gql } from '@apollo/client';

// ============================================
// Federation Cross-Service Queries
// ============================================

/**
 * Example of a federated query that fetches data from multiple services
 * This query gets Claude session data and automatically resolves repository
 * information from the Repo Agent service
 */
export const SESSION_WITH_REPOSITORY_QUERY = gql`
  query SessionWithRepository($sessionId: ID!) {
    session(id: $sessionId) {
      id
      status
      workingDirectory
      createdAt
      # Federation automatically resolves this from Repo Agent service
      repository {
        path
        name
        isDirty
        branch
        uncommittedCount
        status {
          files {
            path
            status
            isStaged
          }
          ahead
          behind
          hasRemote
        }
      }
    }
  }
`;

/**
 * Batch query to get all active sessions with their repository states
 * Demonstrates N+1 query prevention through federation
 */
export const ACTIVE_SESSIONS_WITH_REPOS_QUERY = gql`
  query ActiveSessionsWithRepos {
    sessions {
      id
      status
      workingDirectory
      createdAt
      # Each repository is resolved efficiently by federation
      repository {
        path
        isDirty
        uncommittedCount
        branch
      }
    }
  }
`;

/**
 * Query to get repository details from both local (Repo Agent) 
 * and remote (GitHub) sources
 */
export const REPOSITORY_FULL_DETAILS_QUERY = gql`
  query RepositoryFullDetails($owner: String!, $name: String!, $path: String!) {
    # From Repo Agent service
    repositoryDetails(path: $path) {
      path
      name
      status {
        branch
        isDirty
        ahead
        behind
        files {
          path
          status
          isStaged
        }
      }
      lastCommit {
        hash
        message
        author
        date
      }
    }
    
    # From GitHub Mesh service
    githubRepository(owner: $owner, name: $name) {
      name
      description
      stargazers_count
      open_issues_count
      default_branch
      updated_at
      # Federation can link this to local repository
      localRepository {
        isDirty
        uncommittedCount
        status {
          branch
        }
      }
    }
  }
`;

/**
 * Query to analyze uncommitted changes across all repositories
 * with AI-generated commit message suggestions
 */
export const UNCOMMITTED_CHANGES_ANALYSIS_QUERY = gql`
  query UncommittedChangesAnalysis {
    scanAllDetailed {
      repositories {
        name
        path
        status {
          isDirty
          uncommittedCount
          files {
            path
            status
            isStaged
          }
        }
      }
      statistics {
        totalRepositories
        dirtyRepositories
        totalUncommittedFiles
      }
    }
  }
`;

/**
 * Mutation that combines repository scanning with AI analysis
 * Demonstrates cross-service mutation coordination
 */
export const ANALYZE_AND_COMMIT_MUTATION = gql`
  mutation AnalyzeAndCommit($scanFirst: Boolean!, $styleGuide: CommitStyleGuide) {
    # First scan for changes
    scanResults: scanAllDetailed @include(if: $scanFirst) {
      repositories {
        path
        name
        status {
          isDirty
          files {
            path
            status
          }
        }
      }
    }
    
    # Then generate commit messages for dirty repos
    commitMessages: generateCommitMessages(
      input: {
        repositories: [] # Would be populated from scan results
        styleGuide: $styleGuide
        analyzeRelationships: true
      }
    ) {
      results {
        repositoryPath
        message
        confidence
        commitType
      }
    }
  }
`;

/**
 * Subscription that combines real-time updates from multiple services
 */
export const MULTI_SERVICE_PROGRESS_SUBSCRIPTION = gql`
  subscription MultiServiceProgress($sessionId: ID!, $runId: ID!) {
    # From Claude service
    commandOutput(sessionId: $sessionId) {
      type
      content
      timestamp
    }
    
    # Also from Claude service
    agentRunProgress(runId: $runId) {
      runId
      status
      progress
      stage
      message
    }
  }
`;

/**
 * Query to get comprehensive system health across all services
 */
export const SYSTEM_HEALTH_FEDERATION_QUERY = gql`
  query SystemHealthFederation {
    # Claude service health
    health {
      status
      claudeAvailable
      version
      uptime
    }
    
    # Active sessions count
    sessions {
      id
    }
    
    # Repository statistics
    scanAllDetailed {
      statistics {
        totalRepositories
        dirtyRepositories
      }
      metadata {
        workspaceRoot
      }
    }
    
    # Recent agent runs
    agentRuns(limit: 5) {
      runs {
        id
        status
        repository
        startedAt
      }
      totalCount
    }
  }
`;

// ============================================
// Federation-Specific Fragments
// ============================================

/**
 * Fragment that spans multiple services
 */
export const REPOSITORY_WITH_GITHUB_FRAGMENT = gql`
  fragment RepositoryWithGitHub on Repository {
    path
    name
    isDirty
    branch
    # This would be resolved if we extend Repository in GitHub Mesh
    githubData {
      stargazers_count
      open_issues_count
      has_issues
      has_projects
    }
  }
`;

/**
 * Fragment for session with full context
 */
export const SESSION_FULL_CONTEXT_FRAGMENT = gql`
  fragment SessionFullContext on ClaudeSession {
    id
    status
    workingDirectory
    createdAt
    repository {
      path
      isDirty
      uncommittedCount
    }
    agentRuns {
      id
      status
      completedAt
    }
  }
`;