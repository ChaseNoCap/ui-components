import { gql } from '@apollo/client';

// Git Mutations
export const EXECUTE_GIT_COMMAND_MUTATION = gql`
  mutation ExecuteGitCommand($input: GitCommandInput!) {
    executeGitCommand(input: $input) {
      success
      output
      error
    }
  }
`;

export const COMMIT_CHANGES_MUTATION = gql`
  mutation CommitChanges($input: CommitInput!) {
    commitChanges(input: $input) {
      success
      commitHash
      branch
      author
      timestamp
      error
    }
  }
`;

export const BATCH_COMMIT_MUTATION = gql`
  mutation BatchCommit($input: BatchCommitInput!) {
    batchCommit(input: $input) {
      success
      results {
        repository
        success
        commitHash
        error
      }
      summary {
        total
        successful
        failed
      }
    }
  }
`;

export const PUSH_CHANGES_MUTATION = gql`
  mutation PushChanges($input: PushInput!) {
    pushChanges(input: $input) {
      success
      branch
      remoteUrl
      error
    }
  }
`;

// Claude Mutations
export const EXECUTE_CLAUDE_COMMAND_MUTATION = gql`
  mutation ExecuteClaudeCommand($input: ClaudeExecuteInput!) {
    executeCommand(input: $input) {
      sessionId
      status
      output
      error
    }
  }
`;

export const CONTINUE_CLAUDE_SESSION_MUTATION = gql`
  mutation ContinueClaudeSession($input: ContinueSessionInput!) {
    continueSession(input: $input) {
      sessionId
      status
      output
      error
    }
  }
`;

export const KILL_CLAUDE_SESSION_MUTATION = gql`
  mutation KillClaudeSession($id: ID!) {
    killSession(id: $id)
  }
`;

export const GENERATE_COMMIT_MESSAGES_MUTATION = gql`
  mutation GenerateCommitMessages($input: BatchCommitMessageInput!) {
    generateCommitMessages(input: $input) {
      messages {
        repository
        message
        confidence
        error
      }
      statistics {
        total
        successful
        failed
        averageTime
      }
    }
  }
`;

export const GENERATE_EXECUTIVE_SUMMARY_MUTATION = gql`
  mutation GenerateExecutiveSummary($input: ExecutiveSummaryInput!) {
    generateExecutiveSummary(input: $input) {
      summary
      categories {
        category
        items
        impact
      }
      risks
      recommendations
    }
  }
`;

export const CREATE_HANDOFF_MUTATION = gql`
  mutation CreateHandoff($input: HandoffInput!) {
    createHandoff(input: $input) {
      success
      handoffPath
      content
      error
    }
  }
`;