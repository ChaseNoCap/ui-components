import { gql, DocumentNode } from '@apollo/client';
import { apolloClient as client } from '../lib/apollo-client';
import { SCAN_ALL_DETAILED } from '../graphql/git-operations';
import type { 
  ChangeReviewReport, 
  RepositoryChangeData, 
  ScanProgress 
} from './changeReviewService';

// Queries and Mutations
const GENERATE_EXECUTIVE_SUMMARY = gql`
  mutation GenerateExecutiveSummary($input: ExecutiveSummaryInput!) {
    generateExecutiveSummary(input: $input) {
      success
      summary
      error
      metadata {
        repositoryCount
        totalChanges
        themes {
          name
          description
          affectedRepositories
          impact
        }
        riskLevel
        suggestedActions
      }
    }
  }
`;

const BATCH_COMMIT = gql`
  mutation BatchCommit($input: BatchCommitInput!) {
    batchCommit(input: $input) {
      totalRepositories
      successCount
      results {
        success
        commitHash
        error
        repository
        committedFiles
        isClean
        remainingFiles
      }
    }
  }
`;

// Single commit message mutation fragment
const COMMIT_MESSAGE_FRAGMENT = gql`
  fragment CommitMessageFields on CommitMessageResult {
    repositoryPath
    repositoryName
    success
    message
    error
    confidence
    commitType
  }
`;

// Helper to build parallel mutation
function buildParallelCommitMessageMutation(repositories: RepositoryChangeData[]): DocumentNode {
  const mutations = repositories
    .filter(r => r.hasChanges)
    .map((repo, index) => {
      const alias = `msg${index}`;
      const inputVar = `$input${index}`;
      
      return `
        ${alias}: generateCommitMessages(input: ${inputVar}) {
          results {
            ...CommitMessageFields
          }
          totalTokenUsage {
            inputTokens
            outputTokens
            estimatedCost
          }
          executionTime
        }
      `;
    });

  const variableDefinitions = repositories
    .filter(r => r.hasChanges)
    .map((_, index) => `$input${index}: BatchCommitMessageInput!`)
    .join(', ');

  return gql`
    ${COMMIT_MESSAGE_FRAGMENT}
    
    mutation ParallelCommitMessages(${variableDefinitions}) {
      ${mutations.join('\n')}
    }
  `;
}

export class GraphQLParallelChangeReviewService {
  private isReviewInProgress = false;

  /**
   * Reset the review in progress flag (for error recovery)
   */
  public resetReviewState() {
    this.isReviewInProgress = false;
  }

  /**
   * Scan all repositories using GraphQL
   */
  async scanAllRepositories(
    onProgress?: (progress: ScanProgress) => void
  ): Promise<RepositoryChangeData[]> {
    try {
      onProgress?.({
        stage: 'scanning',
        message: 'Scanning all repositories for changes...'
      });

      const result = await client.query({
        query: SCAN_ALL_DETAILED,
        fetchPolicy: 'network-only'
      });

      if (!result.data) {
        console.error('GraphQL query returned no data:', result);
        throw new Error('Failed to fetch repository data');
      }

      const scanReport = result.data.scanAllDetailed;
      
      onProgress?.({
        stage: 'scanning',
        message: `Found ${scanReport.statistics.totalRepositories} repositories`,
        current: scanReport.statistics.totalRepositories,
        total: scanReport.statistics.totalRepositories
      });

      // Transform GraphQL response to match existing interface
      return scanReport.repositories.map((repo: any) => {
        // Transform file changes
        const changes = repo.status.files.map((file: any) => ({
          file: file.path,
          status: file.status,
          staged: file.isStaged,
          unstaged: !file.isStaged
        }));

        // Separate submodule changes
        const submoduleChanges = changes.filter((c: any) => 
          c.file.startsWith('packages/') && c.status === 'M'
        );
        const regularChanges = changes.filter((c: any) => 
          !c.file.startsWith('packages/') || c.status !== 'M'
        );

        // Calculate statistics
        const statistics = {
          totalFiles: regularChanges.length,
          totalFilesWithSubmodules: changes.length,
          stagedFiles: regularChanges.filter((c: any) => c.staged).length,
          unstagedFiles: regularChanges.filter((c: any) => c.unstaged).length,
          additions: regularChanges.filter((c: any) => c.status === 'A').length,
          modifications: regularChanges.filter((c: any) => c.status === 'M').length,
          deletions: regularChanges.filter((c: any) => c.status === 'D').length,
          hiddenSubmoduleChanges: submoduleChanges.length
        };

        return {
          name: repo.name,
          path: repo.path,
          branch: {
            current: repo.branch,
            tracking: ''
          },
          changes: regularChanges,
          hasChanges: repo.isDirty,
          recentCommits: [],
          gitDiff: {
            staged: '',
            unstaged: ''
          },
          newFileContents: {},
          statistics,
          hasHiddenSubmoduleChanges: submoduleChanges.length > 0,
          _submoduleChanges: submoduleChanges
        };
      });
    } catch (error) {
      console.error('Error scanning repositories:', error);
      throw error;
    }
  }

  /**
   * Generate commit messages using truly parallel GraphQL mutations
   */
  async generateCommitMessages(
    repositories: RepositoryChangeData[],
    onProgress?: (progress: ScanProgress) => void
  ): Promise<RepositoryChangeData[]> {
    const reposWithChanges = repositories.filter(r => r.hasChanges);
    
    if (reposWithChanges.length === 0) {
      return repositories;
    }

    onProgress?.({
      stage: 'generating',
      message: `Generating ${reposWithChanges.length} commit messages in parallel...`,
      current: 0,
      total: reposWithChanges.length
    });

    try {
      // Build parallel mutation and variables
      const parallelMutation = buildParallelCommitMessageMutation(reposWithChanges);
      
      const variables: any = {};
      reposWithChanges.forEach((repo, index) => {
        variables[`input${index}`] = {
          repositories: [{
            path: repo.path,
            name: repo.name,
            diff: repo.gitDiff.unstaged + '\n' + repo.gitDiff.staged,
            filesChanged: repo.changes.map(c => c.file),
            recentCommits: repo.recentCommits.slice(0, 5).map(c => c.message),
            context: `Repository: ${repo.name}, Branch: ${repo.branch.current}`
          }],
          styleGuide: {
            format: 'conventional',
            maxLength: 72,
            includeScope: true,
            includeBody: true
          },
          analyzeRelationships: false // Don't analyze relationships for individual repos
        };
      });

      // Execute parallel mutations
      const startTime = Date.now();
      const { data } = await client.mutate({
        mutation: parallelMutation,
        variables
      });

      const executionTime = Date.now() - startTime;
      console.log(`Generated ${reposWithChanges.length} commit messages in ${executionTime}ms (parallel)`);

      // Process results
      let processedCount = 0;
      const resultMap = new Map<string, string>();
      
      reposWithChanges.forEach((repo, index) => {
        const result = data[`msg${index}`];
        if (result && result.results[0] && result.results[0].success) {
          resultMap.set(repo.name, result.results[0].message);
          processedCount++;
          
          onProgress?.({
            stage: 'generating',
            message: `Generated message for ${repo.name}`,
            current: processedCount,
            total: reposWithChanges.length
          });
        }
      });

      // Map results back to repositories
      return repositories.map(repo => {
        const message = resultMap.get(repo.name);
        if (message) {
          return {
            ...repo,
            generatedCommitMessage: message
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
   * Generate executive summary using GraphQL
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
      const input = {
        commitMessages: reposWithMessages.map(repo => ({
          repository: repo.name,
          message: repo.generatedCommitMessage!,
          stats: {
            filesChanged: repo.statistics.totalFiles,
            additions: repo.statistics.additions,
            deletions: repo.statistics.deletions
          }
        })),
        audience: 'technical',
        maxLength: 500,
        focusAreas: ['breaking-changes', 'new-features', 'performance'],
        includeRiskAssessment: true,
        includeRecommendations: true
      };

      const { data } = await client.mutate({
        mutation: GENERATE_EXECUTIVE_SUMMARY,
        variables: { input }
      });

      if (data.generateExecutiveSummary.success) {
        return data.generateExecutiveSummary.summary;
      } else {
        console.warn('Failed to generate AI executive summary, using fallback');
        return this.generateFallbackExecutiveSummary(repositories);
      }
    } catch (error) {
      console.error('Error generating executive summary:', error);
      return this.generateFallbackExecutiveSummary(repositories);
    }
  }

  /**
   * Main entry point: scan all repos and generate complete report
   */
  async performComprehensiveReview(
    onProgress?: (progress: ScanProgress) => void
  ): Promise<ChangeReviewReport> {
    // Prevent concurrent reviews
    if (this.isReviewInProgress) {
      console.log('Review already in progress, skipping duplicate call');
      // Return empty report instead of throwing to handle React StrictMode better
      return {
        executiveSummary: '',
        generatedAt: new Date(),
        repositories: [],
        statistics: {
          totalFiles: 0,
          totalAdditions: 0,
          totalDeletions: 0,
          totalModifications: 0,
          affectedPackages: []
        },
        scanTime: new Date().toISOString()
      };
    }
    
    this.isReviewInProgress = true;
    
    try {
      // 1. Scan all repositories
      const repositories = await this.scanAllRepositories(onProgress);
      
      // 2. Generate commit messages using parallel GraphQL
      const reposWithMessages = await this.generateCommitMessages(repositories, onProgress);
      
      // 3. Generate executive summary
      const executiveSummary = await this.generateExecutiveSummary(reposWithMessages, onProgress);
      
      // 4. Compile final report
      const report = await this.generateChangeReport(reposWithMessages, executiveSummary);
      
      // Set appropriate completion message based on whether changes were found
      const changedRepoCount = repositories.filter(r => r.hasChanges).length;
      onProgress?.({
        stage: 'complete',
        message: changedRepoCount === 0 ? 'All repositories are clean!' : 'Change review complete!'
      });
      
      return report;
    } catch (error) {
      console.error('Error performing comprehensive review:', error);
      throw error;
    } finally {
      this.isReviewInProgress = false;
    }
  }

  /**
   * Generate a complete change review report
   */
  private async generateChangeReport(
    repositories: RepositoryChangeData[],
    executiveSummary: string
  ): Promise<ChangeReviewReport> {
    const statistics = {
      totalFiles: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      totalModifications: 0,
      affectedPackages: [] as string[]
    };

    repositories.forEach(repo => {
      if (repo.hasChanges) {
        const repoStats = repo.statistics || {
          totalFiles: 0,
          additions: 0,
          deletions: 0,
          modifications: 0,
          stagedFiles: 0,
          unstagedFiles: 0
        };
        
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
   * Fallback commit message generation
   */
  private generateFallbackCommitMessages(
    repositories: RepositoryChangeData[]
  ): RepositoryChangeData[] {
    return repositories.map(repo => {
      if (!repo.hasChanges) return repo;

      const stats = repo.statistics || { additions: 0, modifications: 0, deletions: 0 };
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
   * Commit changes to a repository using GraphQL
   */
  async commitRepository(
    repositoryPath: string,
    commitMessage: string,
    files?: string[]
  ): Promise<{ success: boolean; commitHash?: string; error?: string }> {
    try {
      const { data } = await client.mutate({
        mutation: BATCH_COMMIT,
        variables: {
          input: {
            commits: [{
              repository: repositoryPath,
              message: commitMessage,
              stageAll: !files || files.length === 0, // Stage all if no specific files
              files
            }],
            continueOnError: false
          }
        }
      });

      const result = data.batchCommit.results[0];
      return {
        success: result.success,
        commitHash: result.commitHash,
        error: result.error
      };
    } catch (error) {
      console.error('Error committing repository:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to commit'
      };
    }
  }

  /**
   * Push changes to remote repository (not implemented yet)
   */
  async pushRepository(repositoryPath: string): Promise<{ success: boolean; branch?: string; error?: string }> {
    // TODO: Implement push functionality when available in GraphQL
    return {
      success: false,
      error: 'Push functionality not yet implemented in GraphQL'
    };
  }

  /**
   * Batch commit changes using GraphQL
   */
  async batchCommit(commits: Array<{ repoPath: string; message: string }>): Promise<any> {
    try {
      const input = {
        commits: commits.map(commit => ({
          repository: commit.repoPath,
          message: commit.message,
          files: [], // Empty means commit all
          stageAll: true
        })),
        continueOnError: true
      };

      const { data } = await client.mutate({
        mutation: BATCH_COMMIT,
        variables: { input }
      });

      return data.batchCommit;
    } catch (error) {
      console.error('Error batch committing:', error);
      throw error;
    }
  }

  /**
   * Batch push changes (not implemented yet)
   */
  async batchPush(repoPaths: string[]): Promise<any> {
    // TODO: Implement batch push functionality when available in GraphQL
    return {
      results: repoPaths.map(path => ({
        repository: path.split('/').pop() || path,
        success: false,
        error: 'Push functionality not yet implemented in GraphQL'
      }))
    };
  }
}

// Export singleton instance
const service = new GraphQLParallelChangeReviewService();

export const graphqlParallelChangeReviewService = {
  async scanAllRepositories(
    onProgress?: (progress: ScanProgress) => void
  ): Promise<RepositoryChangeData[]> {
    return service.scanAllRepositories(onProgress);
  },

  async generateCommitMessages(
    repositories: RepositoryChangeData[],
    onProgress?: (progress: ScanProgress) => void
  ): Promise<RepositoryChangeData[]> {
    return service.generateCommitMessages(repositories, onProgress);
  },

  async generateExecutiveSummary(
    repositories: RepositoryChangeData[],
    onProgress?: (progress: ScanProgress) => void
  ): Promise<string> {
    return service.generateExecutiveSummary(repositories, onProgress);
  },

  async performComprehensiveReview(
    onProgress?: (progress: ScanProgress) => void
  ): Promise<ChangeReviewReport> {
    return service.performComprehensiveReview(onProgress);
  },

  async commitRepository(
    repositoryPath: string,
    commitMessage: string,
    files?: string[]
  ): Promise<{ success: boolean; commitHash?: string; error?: string }> {
    return service.commitRepository(repositoryPath, commitMessage, files);
  },

  async pushRepository(
    repositoryPath: string
  ): Promise<{ success: boolean; branch?: string; error?: string }> {
    return service.pushRepository(repositoryPath);
  },

  resetReviewState() {
    service.resetReviewState();
  },

  async batchCommit(
    commits: Array<{ repoPath: string; message: string }>
  ): Promise<any> {
    return service.batchCommit(commits);
  },

  async batchPush(repoPaths: string[]): Promise<any> {
    return service.batchPush(repoPaths);
  }
};