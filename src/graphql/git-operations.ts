import { gql } from '@apollo/client';

// Input types for mutations
export interface PushInput {
  repository: string;
  remote?: string;
  branch?: string;
  setUpstream?: boolean;
  pushTags?: boolean;
}

// Query to get repository status
export const GET_REPOSITORY_STATUS = gql`
  query GetRepositoryStatus($path: String!) {
    gitStatus(path: $path) {
      __typename
      branch
      isDirty
      files {
        __typename
        path
        status
        isStaged
      }
      ahead
      behind
      hasRemote
      stashes {
        __typename
        index
        message
        timestamp
      }
    }
  }
`;

// Query to scan all repositories
export const SCAN_ALL_REPOSITORIES = gql`
  query ScanAllRepositories {
    scanAllRepositories {
      __typename
      path
      name
      branch
      isDirty
      uncommittedCount
      type
    }
  }
`;

// Query to get detailed repository scan
export const SCAN_ALL_DETAILED = gql`
  query ScanAllDetailed {
    scanAllDetailed {
      __typename
      repositories {
        __typename
        path
        name
        branch
        isDirty
        uncommittedCount
        type
        status {
          __typename
          branch
          isDirty
          ahead
          behind
          hasRemote
          files {
            __typename
            path
            status
            isStaged
          }
          stashes {
            __typename
            index
            message
            timestamp
          }
        }
      }
      statistics {
        __typename
        totalRepositories
        dirtyRepositories
        totalUncommittedFiles
        totalAdditions
        totalDeletions
        changesByType {
          __typename
          modified
          added
          deleted
          renamed
          untracked
        }
      }
      metadata {
        __typename
        startTime
        endTime
        duration
        workspaceRoot
      }
    }
  }
`;

// Query to get repository details
export const GET_REPOSITORY_DETAILS = gql`
  query GetRepositoryDetails($path: String!) {
    repositoryDetails(path: $path) {
      path
      name
      branch
      remoteUrl
      lastCommit {
        sha
        message
        author
        timestamp
      }
      status {
        isClean
        uncommittedCount
        modifiedFiles
      }
    }
  }
`;

// Query to get submodules
export const GET_SUBMODULES = gql`
  query GetSubmodules {
    submodules {
      path
      name
      branch
      uncommittedCount
      status {
        isClean
        modifiedFiles
      }
    }
  }
`;

// Mutation to commit changes
export const COMMIT_CHANGES = gql`
  mutation CommitChanges($input: CommitInput!) {
    commitChanges(input: $input) {
      success
      commitHash
      error
      repository
      committedFiles
      isClean
      remainingFiles
    }
  }
`;

// Mutation for batch commit
export const BATCH_COMMIT = gql`
  mutation BatchCommit($input: BatchCommitInput!) {
    batchCommit(input: $input) {
      totalRepositories
      successCount
      results {
        repository
        success
        commitHash
        error
        committedFiles
        isClean
        remainingFiles
      }
      executionTime
    }
  }
`;

// Mutation to push changes
export const PUSH_CHANGES = gql`
  mutation PushChanges($input: PushInput!) {
    pushChanges(input: $input) {
      success
      remote
      branch
      error
      repository
    }
  }
`;

// Mutation for batch push
export const BATCH_PUSH = gql`
  mutation BatchPush($repositories: [String!]!) {
    batchPush(repositories: $repositories) {
      path
      success
      message
      error
    }
  }
`;

// Mutation to execute git command
export const EXECUTE_GIT_COMMAND = gql`
  mutation ExecuteGitCommand($path: String!, $command: String!, $args: [String!]!) {
    executeGitCommand(path: $path, command: $command, args: $args) {
      success
      output
      error
    }
  }
`;

// Input type for batch commits
export const COMMIT_INPUT_TYPE = gql`
  input CommitInput {
    path: String!
    message: String!
    files: [String!]
  }
`;

// Mutation for hierarchical commit (submodules first, then parent)
export const HIERARCHICAL_COMMIT = gql`
  mutation HierarchicalCommit($input: HierarchicalCommitInput!) {
    hierarchicalCommit(input: $input) {
      success
      totalRepositories
      successCount
      submoduleCommits {
        success
        commitHash
        error
        repository
        committedFiles
        isClean
        remainingFiles
      }
      parentCommit {
        success
        commitHash
        error
        repository
        committedFiles
        isClean
        remainingFiles
      }
      executionTime
      error
    }
  }
`;

// Mutation for hierarchical commit and push
export const HIERARCHICAL_COMMIT_AND_PUSH = gql`
  mutation HierarchicalCommitAndPush($input: HierarchicalCommitInput!) {
    hierarchicalCommitAndPush(input: $input) {
      success
      commitResult {
        success
        totalRepositories
        successCount
        submoduleCommits {
          success
          commitHash
          error
          repository
          committedFiles
          isClean
          remainingFiles
        }
        parentCommit {
          success
          commitHash
          error
          repository
          committedFiles
          isClean
          remainingFiles
        }
        executionTime
        error
      }
      pushResults {
        success
        remote
        branch
        error
        repository
      }
      executionTime
      error
    }
  }
`;