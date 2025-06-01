// Types for comprehensive change review
export interface FileChange {
  file: string;
  status: string;
  staged: boolean;
  unstaged: boolean;
}

export interface BranchInfo {
  current: string;
  tracking: string;
}

export interface RecentCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface RepositoryChangeData {
  name: string;
  path: string;
  branch: BranchInfo;
  changes: FileChange[];
  hasChanges: boolean;
  recentCommits: RecentCommit[];
  gitDiff: {
    staged: string;
    unstaged: string;
  };
  newFileContents: Record<string, string>;
  statistics: {
    totalFiles: number;
    stagedFiles: number;
    unstagedFiles: number;
    additions: number;
    modifications: number;
    deletions: number;
  };
  generatedCommitMessage?: string;
  error?: string;
}

export interface ChangeReviewReport {
  executiveSummary: string;
  generatedAt: Date;
  repositories: RepositoryChangeData[];
  statistics: {
    totalFiles: number;
    totalAdditions: number;
    totalDeletions: number;
    totalModifications: number;
    affectedPackages: string[];
  };
  scanTime: string;
}

export interface ScanProgress {
  stage: 'scanning' | 'analyzing' | 'generating' | 'summarizing' | 'complete';
  message: string;
  current?: number;
  total?: number;
}

export class ChangeReviewService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = import.meta.env.VITE_GIT_API_URL || 'http://localhost:3003';
  }

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

      const response = await fetch(`${this.apiUrl}/api/git/scan-all-detailed`);
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to scan repositories: ${error}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Unknown error scanning repositories');
      }

      onProgress?.({
        stage: 'scanning',
        message: `Found ${data.repositories.length} repositories`,
        current: data.repositories.length,
        total: data.repositories.length
      });

      return data.repositories;
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
      const encodedPath = encodeURIComponent(repoPath);
      const response = await fetch(`${this.apiUrl}/api/git/repo-details/${encodedPath}`);
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get repository details: ${error}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Unknown error getting repository details');
      }

      return data.repository;
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
      // Call Claude API to generate commit messages
      const response = await fetch(`${this.apiUrl}/api/claude/batch-commit-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          repositories: reposWithChanges.map(repo => ({
            name: repo.name,
            branch: repo.branch.current,
            recentCommits: repo.recentCommits.slice(0, 5),
            gitStatus: repo.changes,
            gitDiff: repo.gitDiff,
            newFileContents: repo.newFileContents
          }))
        })
      });

      if (!response.ok) {
        console.warn('Failed to generate AI commit messages, using fallback');
        return this.generateFallbackCommitMessages(repositories);
      }

      const { commitMessages } = await response.json();
      
      // Map commit messages back to repositories
      let processedCount = 0;
      return repositories.map(repo => {
        if (repo.hasChanges && commitMessages[repo.name]) {
          processedCount++;
          onProgress?.({
            stage: 'generating',
            message: `Generated message for ${repo.name}`,
            current: processedCount,
            total: reposWithChanges.length
          });
          
          return {
            ...repo,
            generatedCommitMessage: commitMessages[repo.name]
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
      const response = await fetch(`${this.apiUrl}/api/claude/executive-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          commitMessages: reposWithMessages.map(repo => ({
            repo: repo.name,
            message: repo.generatedCommitMessage
          }))
        })
      });

      if (!response.ok) {
        console.warn('Failed to generate AI executive summary, using fallback');
        return this.generateFallbackExecutiveSummary(repositories);
      }

      const { summary } = await response.json();
      return summary;
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
        statistics.totalFiles += repo.statistics.totalFiles;
        statistics.totalAdditions += repo.statistics.additions;
        statistics.totalDeletions += repo.statistics.deletions;
        statistics.totalModifications += repo.statistics.modifications;
        
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

      const { additions, modifications, deletions } = repo.statistics;
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
      (sum, repo) => sum + repo.statistics.totalFiles,
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
      const response = await fetch(`${this.apiUrl}/api/git/submodules`);
      
      if (!response.ok) {
        throw new Error('Failed to get submodules');
      }

      const data = await response.json();
      return data.submodules || [];
    } catch (error) {
      console.error('Error getting submodules:', error);
      return [];
    }
  }
}

// Export singleton instance
export const changeReviewService = new ChangeReviewService();