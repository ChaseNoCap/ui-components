import { apolloClient } from '@/lib/apollo-client';
import { gitServiceGraphQL } from './gitServiceGraphQL';
import { claudeServiceGraphQL } from './claudeServiceGraphQL';
import { 
  SCAN_ALL_DETAILED,
  GET_REPOSITORY_DETAILS,
  GET_SUBMODULES,
  COMMIT_CHANGES,
  BATCH_COMMIT,
  PUSH_CHANGES,
  BATCH_PUSH
} from '@/graphql/git-operations';

// Import types
import type {
  FileChange,
  BranchInfo,
  RecentCommit,
  RepositoryChangeData,
  ChangeReviewReport,
  ScanProgress
} from './changeReviewService';

// Re-export types from original service
export type {
  FileChange,
  BranchInfo,
  RecentCommit,
  RepositoryChangeData,
  ChangeReviewReport,
  ScanProgress
};

export class ChangeReviewServiceGraphQL {
  /**
   * Scan all repositories (meta + submodules) for comprehensive change data
   */
  async scanAllRepositories(
    onProgress?: (progress: ScanProgress) => void
  ): Promise<RepositoryChangeData[]> {
    try {
      onProgress?.({
        stage: 'scanning',
        message: 'Scanning all repositories for changes...'
      });

      const { data } = await apolloClient.query({
        query: SCAN_ALL_DETAILED,
        fetchPolicy: 'network-only'
      });

      const repositories = data.scanAllDetailed || [];
      
      onProgress?.({
        stage: 'scanning',
        message: `Found ${repositories.length} repositories`,
        current: repositories.length,
        total: repositories.length
      });

      // Transform GraphQL data to match expected format
      return repositories.map((repo: any) => ({
        name: repo.name,
        path: repo.path,
        branch: {
          current: repo.status?.branch || 'main',
          tracking: ''
        },
        changes: (repo.status?.files || []).map((f: any) => ({
          file: f.path,
          status: f.status,
          staged: f.staged,
          unstaged: !f.staged
        })),
        hasChanges: !repo.status?.isClean,
        recentCommits: repo.lastCommit ? [{
          hash: repo.lastCommit.sha,
          message: repo.lastCommit.message,
          author: repo.lastCommit.author,
          date: repo.lastCommit.timestamp
        }] : [],
        gitDiff: { staged: '', unstaged: '' },
        newFileContents: {},
        statistics: {
          totalFiles: repo.status?.files?.length || 0,
          totalFilesWithSubmodules: (repo.status?.files?.length || 0) + (repo.submodules?.length || 0),
          stagedFiles: repo.status?.files?.filter((f: any) => f.staged).length || 0,
          unstagedFiles: repo.status?.files?.filter((f: any) => !f.staged).length || 0,
          additions: repo.status?.files?.filter((f: any) => f.status === 'A').length || 0,
          modifications: repo.status?.files?.filter((f: any) => f.status === 'M').length || 0,
          deletions: repo.status?.files?.filter((f: any) => f.status === 'D').length || 0,
          hiddenSubmoduleChanges: repo.submodules?.filter((s: any) => s.uncommittedCount > 0).length || 0
        },
        hasHiddenSubmoduleChanges: repo.submodules?.some((s: any) => s.uncommittedCount > 0),
        _submoduleChanges: []
      }));
    } catch (error) {
      console.error('Error scanning repositories:', error);
      throw error;
    }
  }

  /**
   * Get detailed data for a specific repository
   */
  async collectRepositoryData(repoPath: string): Promise<RepositoryChangeData> {
    try {
      const { data } = await apolloClient.query({
        query: GET_REPOSITORY_DETAILS,
        variables: { path: repoPath }
      });

      const repo = data.repositoryDetails;
      
      return {
        name: repo.name,
        path: repo.path,
        branch: {
          current: repo.branch || 'main',
          tracking: repo.remoteUrl || ''
        },
        changes: [],
        hasChanges: !repo.status?.isClean,
        recentCommits: repo.lastCommit ? [{
          hash: repo.lastCommit.sha,
          message: repo.lastCommit.message,
          author: repo.lastCommit.author,
          date: repo.lastCommit.timestamp
        }] : [],
        gitDiff: { staged: '', unstaged: '' },
        newFileContents: {},
        statistics: {
          totalFiles: repo.status?.modifiedFiles?.length || 0,
          stagedFiles: 0,
          unstagedFiles: repo.status?.uncommittedCount || 0,
          additions: 0,
          modifications: repo.status?.modifiedFiles?.length || 0,
          deletions: 0
        }
      };
    } catch (error) {
      console.error('Error collecting repository data:', error);
      throw error;
    }
  }

  /**
   * Generate commit messages for repositories with changes
   */
  async generateCommitMessages(
    repositories: RepositoryChangeData[],
    onProgress?: (progress: ScanProgress) => void
  ): Promise<RepositoryChangeData[]> {
    onProgress?.({
      stage: 'generating',
      message: 'Generating AI-powered commit messages...',
      current: 0,
      total: repositories.filter(r => r.hasChanges).length
    });

    const reposWithChanges = repositories.filter(r => r.hasChanges);
    
    if (reposWithChanges.length === 0) {
      return repositories;
    }

    try {
      const result = await claudeServiceGraphQL.generateBatchCommitMessages(
        reposWithChanges.map(repo => ({
          path: repo.path,
          changes: JSON.stringify({
            files: repo.changes,
            statistics: repo.statistics,
            diff: repo.gitDiff
          })
        }))
      );
      
      // Map commit messages back to repositories
      let processedCount = 0;
      return repositories.map(repo => {
        const message = result.find(r => r.repository === repo.path);
        if (repo.hasChanges && message) {
          processedCount++;
          onProgress?.({
            stage: 'generating',
            message: `Generated message for ${repo.name}`,
            current: processedCount,
            total: reposWithChanges.length
          });
          
          return {
            ...repo,
            generatedCommitMessage: message.message
          };
        }
        return repo;
      });
    } catch (error) {
      console.error('Error generating commit messages:', error);
      // Fallback to basic generation
      return this.generateFallbackCommitMessages(repositories);
    }
  }

  /**
   * Generate executive summary from all commit messages
   */
  async generateExecutiveSummary(
    repositories: RepositoryChangeData[],
    onProgress?: (progress: ScanProgress) => void
  ): Promise<string> {
    onProgress?.({
      stage: 'summarizing',
      message: 'Creating executive summary...'
    });

    const reposWithMessages = repositories.filter(
      r => r.hasChanges && r.generatedCommitMessage
    );

    if (reposWithMessages.length === 0) {
      return 'No changes detected across any repositories.';
    }

    try {
      const result = await claudeServiceGraphQL.generateExecutiveSummary(
        reposWithMessages.map(repo => ({
          path: repo.path,
          name: repo.name,
          changes: repo.generatedCommitMessage || '',
          commitCount: 1
        }))
      );
      
      return result.summary;
    } catch (error) {
      console.error('Error generating executive summary:', error);
      return this.generateFallbackExecutiveSummary(repositories);
    }
  }

  /**
   * Generate a complete change review report
   */
  async generateChangeReport(
    repositories: RepositoryChangeData[],
    executiveSummary: string
  ): Promise<ChangeReviewReport> {
    // Calculate overall statistics
    const statistics = {
      totalFiles: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      totalModifications: 0,
      affectedPackages: [] as string[]
    };

    repositories.forEach(repo => {
      if (repo.hasChanges) {
        const repoStats = repo.statistics;
        
        statistics.totalFiles += repoStats.totalFiles || 0;
        statistics.totalAdditions += repoStats.additions || 0;
        statistics.totalDeletions += repoStats.deletions || 0;
        statistics.totalModifications += repoStats.modifications || 0;
        
        if (!statistics.affectedPackages.includes(repo.name)) {
          statistics.affectedPackages.push(repo.name);
        }
      }
    });

    return {
      executiveSummary,
      generatedAt: new Date(),
      repositories,
      statistics,
      scanTime: new Date().toISOString()
    };
  }

  /**
   * Main entry point: scan all repos and generate complete report
   */
  async performComprehensiveReview(
    onProgress?: (progress: ScanProgress) => void
  ): Promise<ChangeReviewReport> {
    try {
      // 1. Scan all repositories
      const repositories = await this.scanAllRepositories(onProgress);
      
      // 2. Generate commit messages for repos with changes
      const reposWithMessages = await this.generateCommitMessages(repositories, onProgress);
      
      // 3. Generate executive summary
      const executiveSummary = await this.generateExecutiveSummary(reposWithMessages, onProgress);
      
      // 4. Compile final report
      const report = await this.generateChangeReport(reposWithMessages, executiveSummary);
      
      onProgress?.({
        stage: 'complete',
        message: 'Change review complete!'
      });
      
      return report;
    } catch (error) {
      console.error('Error performing comprehensive review:', error);
      throw error;
    }
  }

  /**
   * Fallback commit message generation when AI is unavailable
   */
  private generateFallbackCommitMessages(
    repositories: RepositoryChangeData[]
  ): RepositoryChangeData[] {
    return repositories.map(repo => {
      if (!repo.hasChanges) return repo;

      const stats = repo.statistics;
      const { additions = 0, modifications = 0, deletions = 0 } = stats;
      const actions = [];
      
      if (additions > 0) actions.push(`add ${additions} file${additions > 1 ? 's' : ''}`);
      if (modifications > 0) actions.push(`update ${modifications} file${modifications > 1 ? 's' : ''}`);
      if (deletions > 0) actions.push(`remove ${deletions} file${deletions > 1 ? 's' : ''}`);
      
      const message = `chore(${repo.name}): ${actions.join(', ')}`;
      
      return {
        ...repo,
        generatedCommitMessage: message
      };
    });
  }

  /**
   * Fallback executive summary generation
   */
  private generateFallbackExecutiveSummary(
    repositories: RepositoryChangeData[]
  ): string {
    const changedRepos = repositories.filter(r => r.hasChanges);
    
    if (changedRepos.length === 0) {
      return 'No changes detected across any repositories.';
    }

    const totalChanges = changedRepos.reduce(
      (sum, repo) => sum + (repo.statistics?.totalFiles || 0),
      0
    );

    const summary = [
      `• ${changedRepos.length} repositories have uncommitted changes`,
      `• Total of ${totalChanges} files affected across the codebase`,
      `• Primary packages affected: ${changedRepos.map(r => r.name).join(', ')}`
    ];

    return summary.join('\n');
  }

  /**
   * Get list of all submodules
   */
  async getSubmodules(): Promise<Array<{ name: string; path: string; hash: string; ref: string }>> {
    try {
      const { data } = await apolloClient.query({
        query: GET_SUBMODULES,
        fetchPolicy: 'network-only'
      });
      
      return (data.submodules || []).map((s: any) => ({
        name: s.name,
        path: s.path,
        hash: '',
        ref: s.branch || 'main'
      }));
    } catch (error) {
      console.error('Error getting submodules:', error);
      return [];
    }
  }

  /**
   * Commit changes in a single repository
   */
  async commitRepository(repoPath: string, message: string): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      const { data } = await apolloClient.mutate({
        mutation: COMMIT_CHANGES,
        variables: {
          input: {
            repository: repoPath,
            message,
            stageAll: true
          }
        }
      });
      
      return {
        success: data.commitChanges.success,
        output: data.commitChanges.error || 'Commit successful'
      };
    } catch (error) {
      console.error('Error committing repository:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Commit changes in multiple repositories
   */
  async batchCommit(commits: Array<{ repoPath: string; message: string }>): Promise<{
    success: boolean;
    results: Array<{ repository: string; success: boolean; output?: string; error?: string }>
  }> {
    try {
      const { data } = await apolloClient.mutate({
        mutation: BATCH_COMMIT,
        variables: {
          input: {
            commits: commits.map(c => ({
              repository: c.repoPath,
              message: c.message,
              stageAll: true
            }))
          }
        }
      });
      
      const results = data.batchCommit.results.map((result: any) => ({
        repository: result.repository,
        success: result.success,
        output: result.error || 'Commit successful',
        error: result.error
      }));
      
      return {
        success: data.batchCommit.successCount === commits.length,
        results
      };
    } catch (error) {
      console.error('Error batch committing:', error);
      return {
        success: false,
        results: [{
          repository: 'batch',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }]
      };
    }
  }

  /**
   * Push changes in a single repository
   */
  async pushRepository(repoPath: string): Promise<{ success: boolean; output?: string; error?: string; branch?: string }> {
    try {
      const { data } = await apolloClient.mutate({
        mutation: PUSH_CHANGES,
        variables: {
          input: {
            repository: repoPath
          }
        }
      });
      
      return {
        success: data.pushChanges.success,
        output: data.pushChanges.error || 'Push successful',
        branch: data.pushChanges.branch
      };
    } catch (error) {
      console.error('Error pushing repository:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Push changes in multiple repositories
   */
  async batchPush(repositories: string[]): Promise<{
    success: boolean;
    results: Array<{ repository: string; success: boolean; output?: string; error?: string; branch?: string }>
  }> {
    try {
      const { data } = await apolloClient.mutate({
        mutation: BATCH_PUSH,
        variables: {
          repositories
        }
      });
      
      const results = data.batchPush.map((result: any) => ({
        repository: result.path,
        success: result.success,
        output: result.message,
        error: result.error,
        branch: 'main'
      }));
      
      return {
        success: results.every((r: any) => r.success),
        results
      };
    } catch (error) {
      console.error('Error batch pushing:', error);
      return {
        success: false,
        results: [{
          repository: 'batch',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }]
      };
    }
  }
}

// Export singleton instance
export const changeReviewServiceGraphQL = new ChangeReviewServiceGraphQL();