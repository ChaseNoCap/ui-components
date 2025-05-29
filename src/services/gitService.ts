import { createLogger } from '../utils/logger';

const logger = createLogger('gitService');

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

class GitService {
  private baseUrl = '/api/git'; // Will be proxied in development

  /**
   * Execute a git command in a specific repository
   */
  private async execGitCommand(repoPath: string, args: string[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cwd: repoPath,
        args
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Git command failed: ${error}`);
    }

    return response.text();
  }

  /**
   * Get the status of a repository
   */
  async getStatus(repoPath: string): Promise<RepositoryStatus> {
    logger.info(`Getting status for ${repoPath}`);

    try {
      // Get branch info
      const branch = await this.execGitCommand(repoPath, ['branch', '--show-current']);
      
      // Get ahead/behind info
      const revList = await this.execGitCommand(repoPath, [
        'rev-list', 
        '--left-right', 
        '--count', 
        `origin/${branch.trim()}...HEAD`
      ]).catch(() => '0\t0'); // Default if no upstream
      
      const [behind, ahead] = revList.trim().split('\t').map(n => parseInt(n, 10));

      // Get file status
      const statusOutput = await this.execGitCommand(repoPath, ['status', '--porcelain=v1']);
      const files: GitStatus[] = statusOutput
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const status = line.substring(0, 2);
          const file = line.substring(3);
          return {
            file,
            status: this.parseStatusCode(status),
            staged: status[0] !== ' ' && status[0] !== '?'
          };
        });

      return {
        path: repoPath,
        branch: branch.trim(),
        ahead,
        behind,
        files,
        hasUncommittedChanges: files.length > 0
      };
    } catch (error) {
      logger.error(`Failed to get status for ${repoPath}:`, error);
      throw error;
    }
  }

  /**
   * Get diff for specific files
   */
  async getDiff(repoPath: string, files?: string[]): Promise<GitDiff[]> {
    logger.info(`Getting diff for ${repoPath}`);

    try {
      const args = ['diff', '--numstat'];
      if (files?.length) {
        args.push('--', ...files);
      }

      const numstatOutput = await this.execGitCommand(repoPath, args);
      const diffStats = numstatOutput
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [additions, deletions, file] = line.split('\t');
          return {
            file,
            additions: parseInt(additions, 10) || 0,
            deletions: parseInt(deletions, 10) || 0
          };
        });

      // Get actual diffs
      const diffArgs = ['diff'];
      if (files?.length) {
        diffArgs.push('--', ...files);
      }

      const diffOutput = await this.execGitCommand(repoPath, diffArgs);
      
      // Parse and associate diffs with files
      const diffs: GitDiff[] = diffStats.map(stat => ({
        ...stat,
        diff: this.extractDiffForFile(diffOutput, stat.file)
      }));

      return diffs;
    } catch (error) {
      logger.error(`Failed to get diff for ${repoPath}:`, error);
      throw error;
    }
  }

  /**
   * Stage files for commit
   */
  async stageFiles(repoPath: string, files: string[]): Promise<void> {
    logger.info(`Staging ${files.length} files in ${repoPath}`);
    
    await this.execGitCommand(repoPath, ['add', ...files]);
  }

  /**
   * Commit staged changes
   */
  async commit(repoPath: string, message: string, description?: string): Promise<string> {
    logger.info(`Committing changes in ${repoPath}`);

    const fullMessage = description ? `${message}\n\n${description}` : message;
    const output = await this.execGitCommand(repoPath, ['commit', '-m', fullMessage]);
    
    // Extract commit hash from output
    const match = output.match(/\[[\w\s-]+\s+([a-f0-9]+)\]/);
    return match ? match[1] : '';
  }

  /**
   * Push changes to remote
   */
  async push(repoPath: string, branch?: string): Promise<void> {
    logger.info(`Pushing changes in ${repoPath}`);

    const args = ['push'];
    if (branch) {
      args.push('origin', branch);
    }

    await this.execGitCommand(repoPath, args);
  }

  /**
   * Parse git status codes
   */
  private parseStatusCode(code: string): GitStatus['status'] {
    const indexStatus = code[0];
    const workTreeStatus = code[1];

    // Handle untracked files
    if (code === '??') return '??';

    // Handle modified files
    if (indexStatus === 'M' || workTreeStatus === 'M') return 'M';
    
    // Handle added files
    if (indexStatus === 'A') return 'A';
    
    // Handle deleted files
    if (indexStatus === 'D' || workTreeStatus === 'D') return 'D';
    
    // Handle renamed files
    if (indexStatus === 'R') return 'R';
    
    // Handle copied files
    if (indexStatus === 'C') return 'C';
    
    // Handle unmerged files
    if (indexStatus === 'U' || workTreeStatus === 'U') return 'U';

    // Default to modified
    return 'M';
  }

  /**
   * Extract diff for a specific file from full diff output
   */
  private extractDiffForFile(fullDiff: string, fileName: string): string {
    const lines = fullDiff.split('\n');
    const startPattern = `diff --git a/${fileName} b/${fileName}`;
    let capturing = false;
    let fileDiff: string[] = [];

    for (const line of lines) {
      if (line.includes(startPattern)) {
        capturing = true;
      } else if (capturing && line.startsWith('diff --git')) {
        break;
      }
      
      if (capturing) {
        fileDiff.push(line);
      }
    }

    return fileDiff.join('\n');
  }
}

export const gitService = new GitService();