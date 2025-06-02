import { gql } from '@apollo/client';
import { apolloClient as client } from '../lib/apollo-client';
import type { 
  ChangeReviewReport, 
  RepositoryChangeData, 
  ScanProgress 
} from './changeReviewService';

// GraphQL Queries and Mutations
const SCAN_ALL_DETAILED = gql`
  query ScanAllDetailed {
    scanAllDetailed {
      repositories {
        name
        path
        status {
          branch
          isDirty
          ahead
          behind
          hasRemote
          files {
            path
            status
            statusDescription
            isStaged
          }
          stashes {
            index
            message
            timestamp
          }
        }
        stagedDiff
        unstagedDiff
        recentCommits {
          hash
          message
          author
          authorEmail
          timestamp
        }
        remotes {
          name
          fetchUrl
          pushUrl
        }
        config {
          defaultBranch
          isBare
          isShallow
        }
      }
      statistics {
        totalRepositories
        dirtyRepositories
        totalUncommittedFiles
        totalAdditions
        totalDeletions
        changesByType {
          modified
          added
          deleted
          renamed
          untracked
        }
      }
      metadata {
        startTime
        endTime
        duration
        workspaceRoot
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
      // Start with initial progress
      onProgress?.({
        stage: 'scanning',
        message: 'Connecting to GraphQL server...',
        current: 0,
        total: 100
      });

      console.log('🔍 Starting GraphQL query');
      
      // Simulate progress during the query
      let progressValue = 0;
      const progressInterval = setInterval(() => {
        progressValue = Math.min(progressValue + 10, 50);
        onProgress?.({
          stage: 'scanning',
          message: 'Scanning repositories for changes...',
          current: progressValue,
          total: 100
        });
      }, 200);
      
      let response;
      try {
        response = await client.query({
          query: SCAN_ALL_DETAILED,
          fetchPolicy: 'no-cache', // Bypass cache completely
          errorPolicy: 'all', // Handle partial errors
          context: {
            // Add timestamp to force fresh data
            forceFetch: true,
            timestamp: Date.now()
          }
        });
        console.log('✅ GraphQL query response:', response);
      } catch (queryError) {
        clearInterval(progressInterval);
        console.error('❌ GraphQL query error:', queryError);
        throw new Error(`GraphQL query failed: ${queryError instanceof Error ? queryError.message : String(queryError)}`);
      } finally {
        clearInterval(progressInterval);
      }

      if (!response || !response.data) {
        console.error('❌ No data in response:', response);
        throw new Error('GraphQL query returned no data');
      }

      const { data } = response;
      console.log('📊 Data received:', data);

      if (!data.scanAllDetailed) {
        console.error('❌ No scanAllDetailed in data:', data);
        throw new Error('GraphQL query did not return scanAllDetailed');
      }

      const scanReport = data.scanAllDetailed;
      
      onProgress?.({
        stage: 'scanning',
        message: `Processing ${scanReport.statistics.totalRepositories} repositories...`,
        current: 60,
        total: 100
      });

      // Transform GraphQL response to match existing interface
      const totalRepos = scanReport.repositories.length;
      return scanReport.repositories.map((repo: any, index: number) => {
        const { name, path, status, stagedDiff, unstagedDiff, recentCommits } = repo;
        
        // Update progress for each repo processed
        onProgress?.({
          stage: 'scanning',
          message: `Processing ${name}...`,
          current: 60 + Math.floor((40 * (index + 1)) / totalRepos),
          total: 100
        });
        
        // Transform file changes
        const changes = status.files.map((file: any) => ({
          file: file.path,
          status: file.status,
          staged: file.isStaged,
          unstaged: !file.isStaged
        }));

        // Only filter submodule changes for the meta repository (matching REST API behavior)
        const isMetaRepo = name === 'meta-gothic-framework';
        const submoduleChanges = isMetaRepo 
          ? changes.filter((c: any) => c.file.startsWith('packages/') && c.status === 'M')
          : [];
        const regularChanges = isMetaRepo
          ? changes.filter((c: any) => !c.file.startsWith('packages/') || c.status !== 'M')
          : changes;

        // Calculate statistics - match REST API behavior
        const statistics = {
          totalFiles: regularChanges.length,
          totalFilesWithSubmodules: changes.length,
          stagedFiles: regularChanges.filter((c: any) => c.staged).length,
          unstagedFiles: regularChanges.filter((c: any) => c.unstaged).length,
          // Match REST API: untracked files (??) are counted as additions
          additions: regularChanges.filter((c: any) => c.status === '??' || c.status === 'A').length,
          modifications: regularChanges.filter((c: any) => c.status === 'M').length,
          deletions: regularChanges.filter((c: any) => c.status === 'D').length,
          hiddenSubmoduleChanges: submoduleChanges.length
        };

        return {
          name: name,
          path: path,
          branch: {
            current: status.branch,
            tracking: ''
          },
          changes: regularChanges,
          hasChanges: status.isDirty,
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
      if (error instanceof Error && error.message.includes('404')) {
        throw new Error('GraphQL endpoint not found. Please ensure the gateway is running on port 3000');
      }
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
    const reposWithChanges = repositories.filter(r => r.hasChanges);
    
    onProgress?.({
      stage: 'generating',
      message: 'Preparing to generate commit messages...',
      current: 0,
      total: reposWithChanges.length
    });
    
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
      
      // 2. Transition to analyzing stage
      onProgress?.({
        stage: 'analyzing',
        message: 'Analyzing repository changes...',
        current: 0,
        total: repositories.filter(r => r.hasChanges).length
      });
      
      // Brief pause to show the analyzing stage
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 3. Generate commit messages using parallel GraphQL
      const reposWithMessages = await this.generateCommitMessages(repositories, onProgress);
      
      // 4. Generate executive summary
      const executiveSummary = await this.generateExecutiveSummary(reposWithMessages, onProgress);
      
      // 5. Compile final report
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
// Create singleton instance
const service = new GraphQLChangeReviewService();

// Export with the expected interface
export const graphqlChangeReviewService = {
  async performComprehensiveReview(onProgress?: (progress: ScanProgress) => void): Promise<ChangeReviewReport> {
    return service.performComprehensiveReview(onProgress);
  },
  
  async generateChangeReviewReport(onProgress?: (progress: ScanProgress) => void): Promise<ChangeReviewReport> {
    return service.performComprehensiveReview(onProgress);
  },
  
  async commitRepository(
    repositoryPath: string,
    commitMessage: string,
    _files?: string[]
  ): Promise<{ success: boolean; commitHash?: string; error?: string }> {
    try {
      const commits = await service.batchCommit([{ repoPath: repositoryPath, message: commitMessage }]);
      const result = commits.results?.[0];
      return {
        success: result?.result?.success || false,
        commitHash: result?.result?.commitHash,
        error: result?.result?.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to commit'
      };
    }
  },
  
  async pushRepository(
    _repositoryPath: string
  ): Promise<{ success: boolean; branch?: string; error?: string }> {
    // TODO: Implement push functionality when available in GraphQL
    return {
      success: false,
      error: 'Push functionality not yet implemented in GraphQL'
    };
  }
};