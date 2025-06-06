import { apolloClient } from '@/lib/apollo-client';
import { createLogger } from '@/utils/logger';
import {
  GET_REPOSITORY_STATUS,
  SCAN_ALL_REPOSITORIES,
  SCAN_ALL_DETAILED,
  GET_REPOSITORY_DETAILS,
  GET_SUBMODULES,
  COMMIT_CHANGES,
  BATCH_COMMIT,
  PUSH_CHANGES,
  BATCH_PUSH,
  EXECUTE_GIT_COMMAND,
} from '@/graphql/git-operations';

const logger = createLogger('gitServiceGraphQL');

export interface GitStatus {
  file: string;
  status: 'M' | 'A' | 'D' | '??' | 'R' | 'C' | 'U';
  staged: boolean;
}

export interface RepositoryStatus {
  path: string;
  branch: string;
  ahead: number;
  behind: number;
  files: GitStatus[];
  hasUncommittedChanges: boolean;
}

export interface GitDiff {
  file: string;
  additions: number;
  deletions: number;
  diff: string;
}

class GitServiceGraphQL {
  /**
   * Get the status of a specific repository
   */
  async getStatus(repoPath: string): Promise<RepositoryStatus> {
    try {
      const { data } = await apolloClient.query({
        query: GET_REPOSITORY_STATUS,
        variables: { path: repoPath }
      });

      const status = data.gitStatus;
      return {
        path: repoPath, // Use the input path since it's not in the response
        branch: status.branch,
        ahead: status.ahead || 0,
        behind: status.behind || 0,
        files: status.files.map((f: any) => ({
          file: f.path,
          status: f.status,
          staged: f.isStaged
        })),
        hasUncommittedChanges: status.isDirty
      };
    } catch (error) {
      logger.error('Failed to get repository status', { error, repoPath });
      throw error;
    }
  }

  /**
   * Scan all repositories and get their status
   */
  async scanAll(): Promise<Array<{ path: string; name: string; status: any }>> {
    try {
      const { data } = await apolloClient.query({
        query: SCAN_ALL_REPOSITORIES,
        fetchPolicy: 'network-only' // Always get fresh data
      });

      return data.scanAllRepositories;
    } catch (error) {
      logger.error('Failed to scan all repositories', { error });
      throw error;
    }
  }

  /**
   * Get detailed scan of all repositories
   */
  async scanAllDetailed(): Promise<any[]> {
    try {
      const { data } = await apolloClient.query({
        query: SCAN_ALL_DETAILED,
        fetchPolicy: 'network-only'
      });

      return data.scanAllDetailed;
    } catch (error) {
      logger.error('Failed to get detailed scan', { error });
      throw error;
    }
  }

  /**
   * Get repository details
   */
  async getRepositoryDetails(repoPath: string): Promise<any> {
    try {
      const { data } = await apolloClient.query({
        query: GET_REPOSITORY_DETAILS,
        variables: { path: repoPath }
      });

      return data.repositoryDetails;
    } catch (error) {
      logger.error('Failed to get repository details', { error, repoPath });
      throw error;
    }
  }

  /**
   * Get submodules
   */
  async getSubmodules(): Promise<any[]> {
    try {
      const { data } = await apolloClient.query({
        query: GET_SUBMODULES
      });

      return data.submodules;
    } catch (error) {
      logger.error('Failed to get submodules', { error });
      throw error;
    }
  }

  /**
   * Commit changes in a repository
   */
  async commit(repoPath: string, message: string, files?: string[]): Promise<any> {
    try {
      const { data } = await apolloClient.mutate({
        mutation: COMMIT_CHANGES,
        variables: {
          path: repoPath,
          message,
          files
        }
      });

      return data.commitChanges;
    } catch (error) {
      logger.error('Failed to commit changes', { error, repoPath });
      throw error;
    }
  }

  /**
   * Batch commit changes
   */
  async batchCommit(commits: Array<{ path: string; message: string; files?: string[] }>): Promise<any[]> {
    try {
      const { data } = await apolloClient.mutate({
        mutation: BATCH_COMMIT,
        variables: {
          commits
        }
      });

      return data.batchCommit;
    } catch (error) {
      logger.error('Failed to batch commit', { error });
      throw error;
    }
  }

  /**
   * Push changes to remote
   */
  async push(repoPath: string, branch?: string): Promise<any> {
    try {
      const { data } = await apolloClient.mutate({
        mutation: PUSH_CHANGES,
        variables: {
          input: {
            repository: repoPath,
            branch,
            setUpstream: true
          }
        }
      });

      return data.pushChanges;
    } catch (error) {
      logger.error('Failed to push changes', { error, repoPath });
      throw error;
    }
  }

  /**
   * Batch push changes
   */
  async batchPush(repositories: string[]): Promise<any[]> {
    try {
      const { data } = await apolloClient.mutate({
        mutation: BATCH_PUSH,
        variables: {
          repositories
        }
      });

      return data.batchPush;
    } catch (error) {
      logger.error('Failed to batch push', { error });
      throw error;
    }
  }

  /**
   * Stage files for commit
   */
  async stageFiles(repoPath: string, files: string[]): Promise<void> {
    try {
      await apolloClient.mutate({
        mutation: EXECUTE_GIT_COMMAND,
        variables: {
          path: repoPath,
          command: 'add',
          args: files
        }
      });
    } catch (error) {
      logger.error('Failed to stage files', { error, repoPath, files });
      throw error;
    }
  }

  /**
   * Unstage files
   */
  async unstageFiles(repoPath: string, files: string[]): Promise<void> {
    try {
      await apolloClient.mutate({
        mutation: EXECUTE_GIT_COMMAND,
        variables: {
          path: repoPath,
          command: 'reset',
          args: ['HEAD', ...files]
        }
      });
    } catch (error) {
      logger.error('Failed to unstage files', { error, repoPath, files });
      throw error;
    }
  }

  /**
   * Get diff for uncommitted changes
   */
  async getDiff(repoPath: string, staged: boolean = false): Promise<string> {
    try {
      const { data } = await apolloClient.mutate({
        mutation: EXECUTE_GIT_COMMAND,
        variables: {
          path: repoPath,
          command: 'diff',
          args: staged ? ['--cached'] : []
        }
      });

      return data.executeGitCommand.output;
    } catch (error) {
      logger.error('Failed to get diff', { error, repoPath });
      throw error;
    }
  }

  /**
   * Get the current branch name
   */
  async getCurrentBranch(repoPath: string): Promise<string> {
    try {
      const { data } = await apolloClient.mutate({
        mutation: EXECUTE_GIT_COMMAND,
        variables: {
          path: repoPath,
          command: 'rev-parse',
          args: ['--abbrev-ref', 'HEAD']
        }
      });

      return data.executeGitCommand.output.trim();
    } catch (error) {
      logger.error('Failed to get current branch', { error, repoPath });
      throw error;
    }
  }

  /**
   * Check if there are uncommitted changes
   */
  async hasUncommittedChanges(repoPath: string): Promise<boolean> {
    try {
      const status = await this.getStatus(repoPath);
      return status.hasUncommittedChanges;
    } catch (error) {
      logger.error('Failed to check uncommitted changes', { error, repoPath });
      throw error;
    }
  }
}

// Export singleton instance
export const gitServiceGraphQL = new GitServiceGraphQL();