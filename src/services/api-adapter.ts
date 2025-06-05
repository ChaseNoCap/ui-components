import { apolloClient } from '../lib/apollo-client';
import {
  GIT_STATUS_QUERY,
  SCAN_ALL_REPOSITORIES_QUERY,
  SCAN_ALL_DETAILED_QUERY,
} from '../graphql/queries';
import {
  COMMIT_CHANGES_MUTATION,
  GENERATE_COMMIT_MESSAGES_MUTATION,
  GENERATE_EXECUTIVE_SUMMARY_MUTATION,
} from '../graphql/mutations';

// Always use GraphQL with federation

// Git API Adapter
export const gitApi = {
  async getStatus(path: string): Promise<any> {
    const { data } = await apolloClient.query({
      query: GIT_STATUS_QUERY,
      variables: { path },
      fetchPolicy: 'network-only',
    });
    return data.gitStatus;
  },

  async scanAllRepositories(): Promise<any> {
    const { data } = await apolloClient.query({
      query: SCAN_ALL_REPOSITORIES_QUERY,
      fetchPolicy: 'network-only',
    });
    return data.scanAllRepositories;
  },

  async scanAllDetailed(): Promise<any> {
    const { data } = await apolloClient.query({
      query: SCAN_ALL_DETAILED_QUERY,
      fetchPolicy: 'network-only',
    });
    return data.scanAllDetailed;
  },

  async commitChanges(path: string, message: string, files?: string[]): Promise<any> {
    const { data } = await apolloClient.mutate({
      mutation: COMMIT_CHANGES_MUTATION,
      variables: {
        input: {
          path,
          message,
          files,
        },
      },
    });
    return data.commitChanges;
  },
};

// Claude API Adapter
export const claudeApi = {
  async generateCommitMessages(repositories: Array<{ path: string; diff: string; recentCommits: string[] }>): Promise<any> {
    const { data } = await apolloClient.mutate({
      mutation: GENERATE_COMMIT_MESSAGES_MUTATION,
      variables: {
        input: {
          repositories,
          temperature: 0.3,
          maxTokens: 150,
        },
      },
    });
    return data.generateCommitMessages;
  },

  async generateExecutiveSummary(commitMessages: Array<{ repository: string; message: string }>): Promise<any> {
    const { data } = await apolloClient.mutate({
      mutation: GENERATE_EXECUTIVE_SUMMARY_MUTATION,
      variables: {
        input: {
          commitMessages,
          style: 'executive',
        },
      },
    });
    return data.generateExecutiveSummary;
  },
};

// Combined API object for easy migration
export const api = {
  git: gitApi,
  claude: claudeApi,
};