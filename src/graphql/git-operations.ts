import { gql } from '@apollo/client';

// Query to get repository status
export const GET_REPOSITORY_STATUS = gql`
  query GetRepositoryStatus($path: String!) {
    gitStatus(path: $path) {
      path
      isClean
      branch
      files {
        path
        status
        staged
      }
      ahead
      behind
    }
  }
`;

// Query to scan all repositories
export const SCAN_ALL_REPOSITORIES = gql`
  query ScanAllRepositories {
    scanAllRepositories {
      path
      name
      status {
        isClean
        branch
        uncommittedCount
        modifiedFiles
      }
    }
  }
`;

// Query to get detailed repository scan
export const SCAN_ALL_DETAILED = gql`
  query ScanAllDetailed {
    scanAllDetailed {
      path
      name
      status {
        isClean
        branch
        uncommittedCount
        modifiedFiles
        ahead
        behind
        files {
          path
          status
          staged
        }
      }
      lastCommit {
        sha
        message
        author
        timestamp
      }
      submodules {
        path
        name
        branch
        uncommittedCount
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
  mutation CommitChanges($path: String!, $message: String!, $files: [String!]) {
    commitChanges(path: $path, message: $message, files: $files) {
      success
      sha
      message
      isClean
      remainingFiles
    }
  }
`;

// Mutation for batch commit
export const BATCH_COMMIT = gql`
  mutation BatchCommit($commits: [CommitInput!]!) {
    batchCommit(commits: $commits) {
      path
      success
      sha
      message
      error
    }
  }
`;

// Mutation to push changes
export const PUSH_CHANGES = gql`
  mutation PushChanges($path: String!, $branch: String) {
    pushChanges(path: $path, branch: $branch) {
      success
      message
      pushedCommits
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