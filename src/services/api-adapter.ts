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

export type ApiMode = 'rest' | 'graphql';

// Get API mode from environment or default to GraphQL
export const getApiMode = (): ApiMode => {
  return (localStorage.getItem('apiMode') as ApiMode) || 'graphql';
};

export const setApiMode = (mode: ApiMode) => {
  localStorage.setItem('apiMode', mode);
  window.location.reload(); // Reload to apply changes
};

// Git API Adapter
export const gitApi = {
  async getStatus(path: string): Promise<any> {
    const mode = getApiMode();
    
    if (mode === 'graphql') {
      const { data } = await apolloClient.query({
        query: GIT_STATUS_QUERY,
        variables: { path },
        fetchPolicy: 'network-only',
      });
      return data.gitStatus;
    } else {
      // REST fallback
      const response = await fetch(`http://localhost:3003/api/git/status?path=${encodeURIComponent(path)}`);
      if (!response.ok) throw new Error('Failed to fetch git status');
      const data = await response.json();
      return data.status;
    }
  },

  async scanAllRepositories(): Promise<any> {
    const mode = getApiMode();
    
    if (mode === 'graphql') {
      const { data } = await apolloClient.query({
        query: SCAN_ALL_REPOSITORIES_QUERY,
        fetchPolicy: 'network-only',
      });
      return data.scanAllRepositories;
    } else {
      const response = await fetch('http://localhost:3003/api/git/scan-all');
      if (!response.ok) throw new Error('Failed to scan repositories');
      const data = await response.json();
      return data.repositories;
    }
  },

  async scanAllDetailed(): Promise<any> {
    const mode = getApiMode();
    
    if (mode === 'graphql') {
      const { data } = await apolloClient.query({
        query: SCAN_ALL_DETAILED_QUERY,
        fetchPolicy: 'network-only',
      });
      return data.scanAllDetailed;
    } else {
      const response = await fetch('http://localhost:3003/api/git/scan-all-detailed');
      if (!response.ok) throw new Error('Failed to scan repositories');
      const data = await response.json();
      return data;
    }
  },

  async commitChanges(path: string, message: string, files?: string[]): Promise<any> {
    const mode = getApiMode();
    
    if (mode === 'graphql') {
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
    } else {
      const response = await fetch('http://localhost:3003/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, message, files }),
      });
      if (!response.ok) throw new Error('Failed to commit changes');
      return response.json();
    }
  },
};

// Claude API Adapter
export const claudeApi = {
  async generateCommitMessages(repositories: Array<{ path: string; diff: string; recentCommits: string[] }>): Promise<any> {
    const mode = getApiMode();
    
    if (mode === 'graphql') {
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
    } else {
      const response = await fetch('http://localhost:3003/api/claude/batch-commit-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositories }),
      });
      if (!response.ok) throw new Error('Failed to generate commit messages');
      return response.json();
    }
  },

  async generateExecutiveSummary(commitMessages: Array<{ repository: string; message: string }>): Promise<any> {
    const mode = getApiMode();
    
    if (mode === 'graphql') {
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
    } else {
      const response = await fetch('http://localhost:3003/api/claude/executive-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commitMessages }),
      });
      if (!response.ok) throw new Error('Failed to generate executive summary');
      return response.json();
    }
  },
};

// Combined API object for easy migration
export const api = {
  git: gitApi,
  claude: claudeApi,
  mode: {
    get: getApiMode,
    set: setApiMode,
  },
};