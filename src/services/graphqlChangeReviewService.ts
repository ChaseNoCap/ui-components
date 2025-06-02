import { gql } from '@apollo/client';
import { client } from './apolloClient'; // We'll need to create this
import type { 
  ChangeReviewReport, 
  RepositoryChangeData, 
  ScanProgress 
} from './changeReviewService';

// GraphQL Queries and Mutations
const SCAN_ALL_DETAILED = gql`
  query ScanAllDetailed {
    scanAllDetailed {
      timestamp
      totalRepositories
      dirtyRepositories
      repositories {
        repository {
          name
          path
          status {
            branch
            trackingBranch
            files {
              path
              status
              statusDescription
              isStaged
              additions
              deletions
            }
            isDirty
            changeCount
          }
          isSubmodule
          packageInfo {
            name
            version
            description
            private
          }
        }
        stagedDiff
        unstagedDiff
        recentCommits {
          hash
          abbrevHash
          message
          author
          authorEmail
          timestamp
          filesChanged
        }
        stashes {
          index
          message
          timestamp
        }
      }
      statistics {
        totalFiles
        totalAdditions
        totalDeletions
        affectedPackages
        changesByType {
          modified
          added
          deleted
          renamed
          untracked
        }
      }
    }
  }
`;

const GENERATE_COMMIT_MESSAGES = gql`
  mutation GenerateCommitMessages($input: BatchCommitMessageInput!) {
    generateCommitMessages(input: $input) {
      totalRepositories
      successCount
      results {
        repositoryPath
        repositoryName
        success
        message
        error
        confidence
        commitType
      }
      totalTokenUsage {
        inputTokens
        outputTokens
        estimatedCost
      }
      executionTime
    }
  }
`;

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
      failureCount
      results {
        path
        name
        result {
          success
          commitHash
          message
          error
          filesCommitted
        }
      }
      pushAttempted
      pushResults {
        path
        success
        remote
        branch
        error
        summary
      }
    }
  }
`;

export class GraphQLChangeReviewService {
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

      const { data } = await client.query({
        query: SCAN_ALL_DETAILED,
        fetchPolicy: 'network-only' // Always get fresh data
      });

      const scanReport = data.scanAllDetailed;
      
      onProgress?.({
        stage: 'scanning',
        message: `Found ${scanReport.totalRepositories} repositories`,
        current: scanReport.totalRepositories,
        total: scanReport.totalRepositories
      });

      // Transform GraphQL response to match existing interface
      return scanReport.repositories.map((repo: any) => {
        const { repository, stagedDiff, unstagedDiff, recentCommits } = repo;
        
        // Transform file changes
        const changes = repository.status.files.map((file: any) => ({
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
          name: repository.name,
          path: repository.path,
          branch: {
            current: repository.status.branch,
            tracking: repository.status.trackingBranch || ''
          },
          changes: regularChanges,
          hasChanges: repository.status.isDirty,
          recentCommits: recentCommits.map((commit: any) => ({
            hash: commit.hash,
            message: commit.message,
            author: commit.author,
            date: commit.timestamp
          })),
          gitDiff: {
            staged: stagedDiff || '',
            unstaged: unstagedDiff || ''
          },
          newFileContents: {}, // TODO: Implement if needed
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
   * Generate commit messages using parallel GraphQL mutations
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
      // Build input for GraphQL mutation
      const input = {
        repositories: reposWithChanges.map(repo => ({
          path: repo.path,
          name: repo.name,
          diff: repo.gitDiff.unstaged + '\n' + repo.gitDiff.staged,
          filesChanged: repo.changes.map(c => c.file),
          recentCommits: repo.recentCommits.slice(0, 5).map(c => c.message),
          context: `Repository: ${repo.name}, Branch: ${repo.branch.current}`
        })),
        styleGuide: {
          format: 'conventional',
          maxLength: 72,
          includeScope: true,
          includeBody: true
        },
        analyzeRelationships: true
      };

      const { data } = await client.mutate({
        mutation: GENERATE_COMMIT_MESSAGES,
        variables: { input }
      });

      const result = data.generateCommitMessages;
      
      // Map results back to repositories
      let processedCount = 0;
      return repositories.map(repo => {
        const commitResult = result.results.find(
          (r: any) => r.repositoryName === repo.name
        );
        
        if (commitResult && commitResult.success) {
          processedCount++;
          onProgress?.({
            stage: 'generating',
            message: `Generated message for ${repo.name}`,
            current: processedCount,
            total: reposWithChanges.length
          });
          
          return {
            ...repo,
            generatedCommitMessage: commitResult.message
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
   * Batch commit changes using GraphQL
   */
  async batchCommit(commits: Array<{ repoPath: string; message: string }>): Promise<any> {
    try {
      const input = {
        repositories: commits.map(commit => ({
          path: commit.repoPath,
          message: commit.message,
          files: [], // Empty means commit all
          amend: false,
          noVerify: false
        })),
        continueOnError: true,
        pushAfterCommit: false
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
   * Main entry point: scan all repos and generate complete report
   */
  async performComprehensiveReview(
    onProgress?: (progress: ScanProgress) => void
  ): Promise<ChangeReviewReport> {
    try {
      // 1. Scan all repositories
      const repositories = await this.scanAllRepositories(onProgress);
      
      // 2. Generate commit messages using parallel GraphQL
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
}

// Export singleton instance
export const graphqlChangeReviewService = new GraphQLChangeReviewService();