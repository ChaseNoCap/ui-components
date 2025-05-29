import { createLogger } from '../utils/logger';

const logger = createLogger('toolsService');

export interface ChangeItem {
  file: string;
  status: 'M' | 'A' | 'D' | '??';
  changes?: string;
}

export interface PackageChanges {
  package: string;
  path: string;
  changes: ChangeItem[];
  diff?: string;
}

export interface CommitMessage {
  package: string;
  message: string;
  description?: string;
}

class ToolsService {
  /**
   * Scan for uncommitted changes across all Meta GOTHIC packages
   * Uses browser-based git status checking via file system API when available
   */
  async scanUncommittedChanges(): Promise<PackageChanges[]> {
    logger.info('Scanning for uncommitted changes in Meta GOTHIC packages');
    
    // Try to detect VS Code workspace context or current working directory
    try {
      // In browser context, we need to simulate git status checking
      // This would ideally connect to a VS Code extension or backend API
      logger.info('Detecting workspace context for git scanning');
      
      // Get all actual uncommitted changes from workspace
      const allChanges = await this.detectCurrentChanges();
      
      if (allChanges.length === 0) {
        return [];
      }
      
      // Organize changes by package/location
      const changesByPackage = this.organizeChangesByPackage(allChanges);
      logger.info('Organized changes by package:', changesByPackage);
      
      return changesByPackage;
      
    } catch (error) {
      logger.warn('Git scanning failed, returning empty array:', error);
      return [];
    }
  }

  /**
   * Detect current changes in the workspace using real git status
   * NO STATIC DATA - calls backend API or VS Code extension for real git status
   */
  private async detectCurrentChanges(): Promise<ChangeItem[]> {
    try {
      // Get the workspace root first
      const workspaceRoot = await this.detectWorkspaceRoot();
      logger.info(`Scanning for real git changes in: ${workspaceRoot}`);
      
      // Try to call backend API for real git status
      const response = await fetch('/api/git/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspacePath: workspaceRoot
        })
      });

      if (response.ok) {
        const gitStatus = await response.json();
        logger.info('Retrieved real git status from backend:', gitStatus);
        const parsedChanges = this.parseGitStatusOutput(gitStatus.output || '');
        logger.info('Parsed changes:', parsedChanges);
        return parsedChanges;
      } else {
        logger.warn('Backend git API not available, trying VS Code extension');
        return await this.tryVSCodeExtension(workspaceRoot);
      }
    } catch (error) {
      logger.error('Failed to get real git status:', error as Error);
      // Return empty array instead of fallback data to avoid stale data
      return [];
    }
  }

  /**
   * Try to use VS Code extension API for git status
   */
  private async tryVSCodeExtension(workspacePath: string): Promise<ChangeItem[]> {
    try {
      // Check if VS Code extension API is available
      if (typeof window !== 'undefined' && (window as any).vscode) {
        const vscode = (window as any).vscode;
        logger.info('Using VS Code extension for git status');
        
        // Send message to VS Code extension
        const gitStatus = await vscode.postMessage({
          command: 'git.status',
          workspacePath
        });
        
        return this.parseGitStatusOutput(gitStatus);
      } else {
        logger.warn('VS Code extension not available');
        return [];
      }
    } catch (error) {
      logger.error('VS Code extension call failed:', error as Error);
      return [];
    }
  }

  /**
   * Organize changes by package/location 
   */
  private organizeChangesByPackage(changes: ChangeItem[]): PackageChanges[] {
    const packageMap = new Map<string, ChangeItem[]>();
    
    changes.forEach(change => {
      // Determine which package this change belongs to
      const { packageName, relativePath } = this.categorizeFile(change.file);
      
      if (!packageMap.has(packageName)) {
        packageMap.set(packageName, []);
      }
      
      // Add change with relative path within the package
      packageMap.get(packageName)!.push({
        ...change,
        file: relativePath
      });
    });
    
    // Convert map to PackageChanges array
    return Array.from(packageMap.entries()).map(([packageName, changes]) => ({
      package: packageName,
      path: this.getPackagePath(packageName),
      changes
    }));
  }

  /**
   * Categorize a file path to determine package and relative path
   */
  private categorizeFile(filePath: string): { packageName: string; relativePath: string } {
    // Remove meta-gothic-framework prefix if present
    const cleanPath = filePath.replace(/^meta-gothic-framework\//, '');
    
    // Check if it's in a package directory
    if (cleanPath.startsWith('packages/')) {
      const pathParts = cleanPath.split('/');
      if (pathParts.length >= 2) {
        const packageName = pathParts[1]; // e.g., 'ui-components'
        const relativePath = pathParts.slice(2).join('/'); // e.g., 'src/services/toolsService.ts'
        return { packageName, relativePath };
      }
    }
    
    // Root level files (like tsconfig.json, test-change-detection.md)
    return {
      packageName: 'meta-gothic-framework',
      relativePath: cleanPath
    };
  }

  /**
   * Get the display path for a package
   */
  private getPackagePath(packageName: string): string {
    if (packageName === 'meta-gothic-framework') {
      return '.';
    }
    return `packages/${packageName}`;
  }

  /**
   * Parse git status porcelain output into ChangeItem array
   */
  private parseGitStatusOutput(gitOutput: string): ChangeItem[] {
    if (!gitOutput.trim()) {
      return [];
    }

    return gitOutput
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const status = line.substring(0, 2);
        const file = line.substring(3);
        
        // Parse git status codes
        let changeStatus: ChangeItem['status'];
        if (status === '??') {
          changeStatus = '??';
        } else if (status.includes('M')) {
          changeStatus = 'M';
        } else if (status.includes('A')) {
          changeStatus = 'A';
        } else if (status.includes('D')) {
          changeStatus = 'D';
        } else {
          changeStatus = 'M'; // Default to modified
        }

        return {
          file,
          status: changeStatus
        };
      });
  }

  /**
   * Detect the VS Code workspace root directory
   * Uses browser location and path analysis to determine workspace
   */
  private async detectWorkspaceRoot(): Promise<string> {
    try {
      // Try to detect from browser URL or environment
      if (typeof window !== 'undefined') {
        // In development, we know we're in meta-gothic-framework
        // In production, this would query VS Code extension or use file dialogs
        const currentUrl = window.location.pathname;
        logger.info(`Browser path: ${currentUrl}`);
      }
      
      // Check if VS Code workspace API is available
      if (typeof window !== 'undefined' && (window as any).vscode) {
        const vscode = (window as any).vscode;
        const workspaceFolders = await vscode.getWorkspaceFolders();
        if (workspaceFolders && workspaceFolders.length > 0) {
          return workspaceFolders[0].uri.fsPath;
        }
      }
      
      // Default to meta-gothic-framework root
      // In a real implementation, this would be configurable or detected
      return '/Users/josh/Documents/h1b-visa-analysis/meta-gothic-framework';
    } catch (error) {
      logger.warn('Failed to detect workspace root, using default:', error as Error);
      return '/Users/josh/Documents/h1b-visa-analysis/meta-gothic-framework';
    }
  }

  /**
   * Generate commit messages using Claude Code via Node.js subprocess
   * Calls backend endpoint that spawns Claude Code to analyze actual changes
   */
  async generateCommitMessages(changes: PackageChanges[]): Promise<CommitMessage[]> {
    logger.info('Generating commit messages via Claude Code for', changes.length, 'packages');
    
    try {
      // Call backend endpoint that uses Claude Code subprocess
      const response = await fetch('/api/claude/generate-commit-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          changes,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Claude Code API failed: ${response.statusText}`);
      }

      const result = await response.json();
      logger.info('Generated commit messages via Claude Code:', result);
      
      return result.messages || [];
      
    } catch (error) {
      logger.error('Failed to generate commit messages via Claude Code:', error as Error);
      
      // Fallback to basic generated messages based on file analysis
      return this.generateFallbackCommitMessages(changes);
    }
  }

  /**
   * Fallback commit message generation when Claude Code is unavailable
   */
  private generateFallbackCommitMessages(changes: PackageChanges[]): CommitMessage[] {
    return changes.map(pkg => {
      const fileCount = pkg.changes.length;
      const hasNewFiles = pkg.changes.some(c => c.status === 'A');
      const hasModified = pkg.changes.some(c => c.status === 'M');
      const hasDeleted = pkg.changes.some(c => c.status === 'D');
      const hasUntracked = pkg.changes.some(c => c.status === '??');
      
      let message = '';
      let description = '';
      
      // Generate more dynamic messages based on actual changes
      if (hasNewFiles && hasModified) {
        message = `feat: enhance ${pkg.package} with new features and improvements`;
        description = `Added ${pkg.changes.filter(c => c.status === 'A').length} new files and modified ${pkg.changes.filter(c => c.status === 'M').length} existing files`;
      } else if (hasNewFiles || hasUntracked) {
        message = `feat: add new components to ${pkg.package}`;
        description = `Introduced ${fileCount} new files: ${pkg.changes.map(c => c.file).join(', ')}`;
      } else if (hasModified) {
        message = `refactor: update ${pkg.package} implementation`;
        description = `Modified ${fileCount} files: ${pkg.changes.map(c => c.file).join(', ')}`;
      } else if (hasDeleted) {
        message = `refactor: remove unused files from ${pkg.package}`;
        description = `Deleted ${fileCount} files: ${pkg.changes.map(c => c.file).join(', ')}`;
      } else {
        message = `chore: update ${pkg.package}`;
        description = `Updated ${fileCount} files in ${pkg.package}`;
      }
      
      return {
        package: pkg.package,
        message,
        description
      };
    });
  }

  /**
   * Mock implementation of committing changes
   * In production, this would call backend API to execute git commands
   */
  async commitChanges(commitMessages: CommitMessage[]): Promise<void> {
    logger.info('Committing changes for', commitMessages.length, 'packages');
    
    // Mock delay for commits
    await new Promise(resolve => setTimeout(resolve, 1000 * commitMessages.length));
    
    // In production, this would execute git commands
    commitMessages.forEach(commit => {
      logger.info(`Committed ${commit.package}:`, commit.message);
    });
  }

  /**
   * Mock implementation of pushing all repositories
   * In production, this would call backend API to execute git push
   */
  async pushAllRepositories(): Promise<void> {
    logger.info('Pushing all Meta GOTHIC repositories');
    
    // Mock delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    logger.info('Successfully pushed all repositories');
  }

  /**
   * Mock implementation of tagging and publishing
   * In production, this would use GitHub API to create tags and trigger workflows
   */
  async tagAndPublish(packages: string[], versionBump: 'patch' | 'minor' | 'major'): Promise<void> {
    logger.info(`Tagging and publishing ${packages.length} packages with ${versionBump} version bump`);
    
    // Mock delay
    await new Promise(resolve => setTimeout(resolve, 2000 * packages.length));
    
    logger.info('Successfully tagged and triggered publish workflows');
  }
}

// Export singleton instance
export const toolsService = new ToolsService();