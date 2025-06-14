import { gql } from '@apollo/client';

// Query to get workflow runs
export const GET_WORKFLOW_RUNS = gql`
  query GetWorkflowRuns($owner: String!, $repo: String!, $perPage: Int, $page: Int) {
    GitHub_actionsListWorkflowRunsForRepo(
      owner: $owner
      repo: $repo
      per_page: $perPage
      page: $page
    ) {
      total_count
      workflow_runs {
        id
        name
        display_title
        status
        conclusion
        workflow_id
        run_number
        event
        created_at
        updated_at
        head_branch
        head_sha
      }
    }
  }
`;

// Mutation to dispatch a workflow
export const DISPATCH_WORKFLOW = gql`
  mutation DispatchWorkflow(
    $owner: String!
    $repo: String!
    $workflowId: String!
    $ref: String!
    $inputs: JSON
  ) {
    GitHub_actionsCreateWorkflowDispatch(
      owner: $owner
      repo: $repo
      workflow_id: $workflowId
      ref: $ref
      inputs: $inputs
    ) {
      status
    }
  }
`;

// Mutation to cancel a workflow run
export const CANCEL_WORKFLOW_RUN = gql`
  mutation CancelWorkflowRun($owner: String!, $repo: String!, $runId: Int!) {
    GitHub_actionsCancelWorkflowRun(
      owner: $owner
      repo: $repo
      run_id: $runId
    ) {
      status
    }
  }
`;

// Query to get repository issues
export const GET_REPOSITORY_ISSUES = gql`
  query GetRepositoryIssues(
    $owner: String!
    $repo: String!
    $state: String
    $perPage: Int
    $page: Int
  ) {
    GitHub_issuesListForRepo(
      owner: $owner
      repo: $repo
      state: $state
      per_page: $perPage
      page: $page
    ) {
      id
      number
      title
      state
      created_at
      updated_at
      user {
        login
        avatar_url
      }
      labels {
        name
        color
      }
    }
  }
`;

// Query to get pull requests
export const GET_PULL_REQUESTS = gql`
  query GetPullRequests(
    $owner: String!
    $repo: String!
    $state: String
    $perPage: Int
    $page: Int
  ) {
    GitHub_pullsList(
      owner: $owner
      repo: $repo
      state: $state
      per_page: $perPage
      page: $page
    ) {
      id
      number
      title
      state
      created_at
      updated_at
      user {
        login
        avatar_url
      }
      head {
        ref
        sha
      }
      base {
        ref
      }
    }
  }
`;

// Query to list user repositories
export const LIST_USER_REPOSITORIES = gql`
  query ListUserRepositories($perPage: Int, $page: Int, $sort: String) {
    GitHub_reposListForAuthenticatedUser(
      per_page: $perPage
      page: $page
      sort: $sort
    ) {
      id
      name
      full_name
      private
      owner {
        login
        avatar_url
      }
      description
      created_at
      updated_at
      pushed_at
      language
      stargazers_count
      open_issues_count
      default_branch
    }
  }
`;

// Mutation to create a git tag
export const CREATE_GIT_TAG = gql`
  mutation CreateGitTag(
    $owner: String!
    $repo: String!
    $tag: String!
    $message: String!
    $object: String!
    $type: String!
  ) {
    GitHub_gitCreateTag(
      owner: $owner
      repo: $repo
      tag: $tag
      message: $message
      object: $object
      type: $type
    ) {
      tag
      sha
      message
      tagger {
        name
        email
        date
      }
    }
  }
`;

// GraphQL query using native GitHub GraphQL API (already available)
export const GITHUB_GRAPHQL_QUERY = gql`
  query GitHubGraphQL($query: String!, $variables: JSON) {
    github(query: $query, variables: $variables)
  }
`;

// Direct GitHub API queries (from our custom gateway)
export const GET_GITHUB_USER = gql`
  query GetGitHubUser {
    githubUser {
      login
      name
      avatarUrl
      bio
      company
      location
      publicRepos
    }
  }
`;

export const LIST_GITHUB_REPOSITORIES = gql`
  query ListGitHubRepositories($perPage: Int = 30, $page: Int = 1) {
    githubRepositories(perPage: $perPage, page: $page) {
      id
      name
      fullName
      description
      private
      fork
      createdAt
      updatedAt
      pushedAt
      homepage
      size
      stargazersCount
      watchersCount
      language
      forksCount
      openIssuesCount
      defaultBranch
      topics
      owner {
        login
        avatarUrl
      }
    }
  }
`;

export const GET_GITHUB_WORKFLOWS = gql`
  query GetGitHubWorkflows($owner: String!, $repo: String!) {
    githubWorkflows(owner: $owner, repo: $repo) {
      id
      name
      path
      state
    }
  }
`;

export const GET_GITHUB_WORKFLOW_RUNS = gql`
  query GetGitHubWorkflowRuns($owner: String!, $repo: String!, $perPage: Int = 10) {
    githubWorkflowRuns(owner: $owner, repo: $repo, perPage: $perPage) {
      id
      name
      headBranch
      headSha
      status
      conclusion
      workflowId
      url
      createdAt
      updatedAt
    }
  }
`;

export const TRIGGER_GITHUB_WORKFLOW = gql`
  mutation TriggerGitHubWorkflow($owner: String!, $repo: String!, $workflowId: String!, $ref: String = "main") {
    triggerWorkflow(owner: $owner, repo: $repo, workflowId: $workflowId, ref: $ref)
  }
`;

export const CANCEL_GITHUB_WORKFLOW_RUN = gql`
  mutation CancelGitHubWorkflowRun($owner: String!, $repo: String!, $runId: Int!) {
    cancelWorkflowRun(owner: $owner, repo: $repo, runId: $runId)
  }
`;