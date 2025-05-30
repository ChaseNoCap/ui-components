import React, { useEffect, useState } from 'react';
import { GitCommit, AlertCircle, CheckCircle, Clock, FileText } from 'lucide-react';
import { LoadingModal, LoadingStage } from '../../components/LoadingStates/LoadingModal';
import { ErrorMessage } from '../../components/ErrorDisplay';
import { useToast } from '../../components/Toast';
import { dataFetcher } from '../../services/dataFetcher';
import { useTheme } from '../../context';
import clsx from 'clsx';

interface RepositoryChange {
  name: string;
  path: string;
  changes: Array<{
    type: 'modified' | 'new' | 'deleted';
    path: string;
  }>;
  commitMessage?: string;
  error?: string;
}

interface ChangeReviewState {
  isLoading: boolean;
  loadingStages: LoadingStage[];
  repositories: RepositoryChange[];
  executiveSummary: string;
  error: string | null;
}

export const ChangeReview: React.FC = () => {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [state, setState] = useState<ChangeReviewState>({
    isLoading: true,
    loadingStages: [
      { id: 'scan', label: 'Scanning repositories...', status: 'loading' },
      { id: 'analyze', label: 'Analyzing changes...', status: 'pending' },
      { id: 'generate', label: 'Generating AI commit messages...', status: 'pending' },
      { id: 'summary', label: 'Creating executive summary...', status: 'pending' },
    ],
    repositories: [],
    executiveSummary: '',
    error: null,
  });

  useEffect(() => {
    analyzeAllRepositories();
  }, []);

  const analyzeAllRepositories = async () => {
    try {
      setState(prev => ({ 
        ...prev, 
        isLoading: true, 
        loadingStages: [
          { id: 'scan', label: 'Scanning workspace...', status: 'loading' },
          { id: 'analyze', label: 'Analyzing changes...', status: 'pending' },
          { id: 'generate', label: 'Generating AI commit messages...', status: 'pending' },
          { id: 'summary', label: 'Creating executive summary...', status: 'pending' },
        ],
        error: null 
      }));

      // Step 1: Get git status for the entire workspace
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const gitStatusResponse = await fetch('http://localhost:3003/api/git/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspacePath: '/Users/josh/Documents/meta-gothic-framework' }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!gitStatusResponse.ok) {
        throw new Error(`Git status request failed: ${gitStatusResponse.statusText}`);
      }

      const gitStatusData = await gitStatusResponse.json();
      
      if (!gitStatusData.success) {
        throw new Error(gitStatusData.error || 'Failed to get git status');
      }

      setState(prev => ({
        ...prev,
        loadingStages: prev.loadingStages.map(stage =>
          stage.id === 'scan' ? { ...stage, status: 'success' } :
          stage.id === 'analyze' ? { ...stage, status: 'loading' } :
          stage
        )
      }));

      // Step 2: Parse git status output and detect submodule changes
      const statusOutput = gitStatusData.output || '';
      const lines = statusOutput.trim().split('\n').filter(line => line.length > 0);
      
      if (lines.length === 0) {
        setState(prev => ({
          isLoading: false,
          loadingStages: prev.loadingStages.map(stage => ({ ...stage, status: 'success' })),
          repositories: [],
          executiveSummary: 'No changes detected in the workspace.',
          error: null,
        }));
        return;
      }

      const changesByPackage: { [key: string]: Array<{ type: 'modified' | 'new' | 'deleted'; path: string }> } = {};
      const modifiedSubmodules: string[] = [];
      
      // Parse top-level changes and identify modified submodules
      for (const line of lines) {
        if (line.length < 3) continue;
        
        // Git porcelain format: XY filename (sometimes with leading space)
        const trimmedLine = line.trim();
        const parts = trimmedLine.split(/\s+/);
        if (parts.length < 2) continue;
        
        const status = parts[0];
        const filePath = parts.slice(1).join(' '); // Rejoin in case filename has spaces
        
        // Check if this is a submodule change  
        // For submodules, the path will be exactly "packages/submodule-name" with no additional slashes
        if (filePath.startsWith('packages/') && filePath.split('/').length === 2) {
          // This is a modified submodule
          const submoduleName = filePath.replace('packages/', '');
          modifiedSubmodules.push(submoduleName);
          continue;
        }
        
        // Handle direct changes in the meta repo
        let changeType: 'modified' | 'new' | 'deleted' = 'modified';
        if (status.includes('A') || status.includes('?')) {
          changeType = 'new';
        } else if (status.includes('D')) {
          changeType = 'deleted';
        }
        
        const packageName = 'meta-gothic-framework';
        if (!changesByPackage[packageName]) {
          changesByPackage[packageName] = [];
        }
        
        changesByPackage[packageName].push({
          type: changeType,
          path: filePath,
        });
      }

      // For each modified submodule, get its individual git status
      for (const submoduleName of modifiedSubmodules) {
        try {
          const submodulePath = `/Users/josh/Documents/meta-gothic-framework/packages/${submoduleName}`;
          
          const submoduleStatusResponse = await fetch('http://localhost:3003/api/git/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspacePath: submodulePath }),
          });

          if (submoduleStatusResponse.ok) {
            const submoduleStatusData = await submoduleStatusResponse.json();
            
            if (submoduleStatusData.success && submoduleStatusData.output) {
              const submoduleLines = submoduleStatusData.output.trim().split('\n').filter((line: string) => line.length > 0);
              
              if (!changesByPackage[submoduleName]) {
                changesByPackage[submoduleName] = [];
              }
              
              for (const subLine of submoduleLines) {
                if (subLine.length < 3) continue;
                
                const trimmedSubLine = subLine.trim();
                const subParts = trimmedSubLine.split(/\s+/);
                if (subParts.length < 2) continue;
                
                const subStatus = subParts[0];
                const subFilePath = subParts.slice(1).join(' ');
                
                let changeType: 'modified' | 'new' | 'deleted' = 'modified';
                if (subStatus.includes('A') || subStatus.includes('?')) {
                  changeType = 'new';
                } else if (subStatus.includes('D')) {
                  changeType = 'deleted';
                }
                
                changesByPackage[submoduleName].push({
                  type: changeType,
                  path: subFilePath,
                });
              }
            }
          }
        } catch (error) {
          console.error(`Failed to get status for submodule ${submoduleName}:`, error);
          
          // Add a fallback entry indicating the submodule has changes
          if (!changesByPackage[submoduleName]) {
            changesByPackage[submoduleName] = [];
          }
          changesByPackage[submoduleName].push({
            type: 'modified',
            path: 'submodule-changes-detected',
          });
        }
      }

      // Convert to RepositoryChange format
      const repoChanges: RepositoryChange[] = Object.entries(changesByPackage).map(([name, changes]) => ({
        name,
        path: name === 'meta-gothic-framework' ? '.' : `packages/${name}`,
        changes,
      }));

      setState(prev => ({
        ...prev,
        loadingStages: prev.loadingStages.map(stage =>
          stage.id === 'analyze' ? { ...stage, status: 'success' } :
          stage.id === 'generate' ? { ...stage, status: 'loading' } :
          stage
        )
      }));

      // Step 3: Generate commit messages for each package with changes
      const reposWithMessages = await Promise.all(
        repoChanges.map(async (repo) => {
          try {
            // Create a changes object with the package name as key
            const changesForPackage = {
              [repo.name]: repo.changes.map(change => ({
                type: change.type,
                path: change.path,
              })),
            };

            const response = await fetch('http://localhost:3003/api/claude/generate-commit-messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                workspaceRoot: '/Users/josh/Documents/meta-gothic-framework',
                changes: changesForPackage,
              }),
            });

            if (!response.ok) {
              throw new Error(`Failed to generate commit message: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Claude response for', repo.name, ':', data);
            
            return {
              ...repo,
              commitMessage: data.commitMessages?.[repo.name] || data.message || 'No commit message generated',
            };
          } catch (error) {
            console.error(`Failed to generate commit message for ${repo.name}:`, error);
            return {
              ...repo,
              error: `Failed to generate commit message: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
          }
        })
      );

      setState(prev => ({
        ...prev,
        loadingStages: prev.loadingStages.map(stage =>
          stage.id === 'generate' ? { ...stage, status: 'success' } :
          stage.id === 'summary' ? { ...stage, status: 'loading' } :
          stage
        )
      }));

      // Step 4: Generate executive summary
      const executiveSummary = generateExecutiveSummary(reposWithMessages);

      setState(prev => ({
        isLoading: false,
        loadingStages: prev.loadingStages.map(stage => ({ ...stage, status: 'success' })),
        repositories: reposWithMessages,
        executiveSummary,
        error: null,
      }));

    } catch (error) {
      console.error('Failed to analyze repositories:', error);
      
      let errorMessage = 'Failed to analyze repository changes';
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.name === 'AbortError') {
          errorMessage = 'Request timed out - git server may be unresponsive';
        }
      }
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  };

  const generateExecutiveSummary = (repos: RepositoryChange[]): string => {
    const totalRepos = repos.length;
    const totalChanges = repos.reduce((sum, repo) => sum + repo.changes.length, 0);
    
    const changeTypes = repos.flatMap(r => r.changes).reduce((acc, change) => {
      acc[change.type] = (acc[change.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const summary = [
      `## Change Review Summary`,
      ``,
      `**${totalRepos} repositories** with **${totalChanges} total changes**:`,
      `- ${changeTypes.modified || 0} modified files`,
      `- ${changeTypes.new || 0} new files`,
      `- ${changeTypes.deleted || 0} deleted files`,
      ``,
      `### Affected Repositories:`,
      ...repos.map(repo => `- **${repo.name}**: ${repo.changes.length} changes`),
    ].join('\n');

    return summary;
  };

  const handleCommit = async (repo: RepositoryChange) => {
    if (!repo.commitMessage) {
      showToast({ type: 'error', message: 'No commit message available' });
      return;
    }

    try {
      // TODO: Implement actual git commit
      showToast({ type: 'success', message: `Changes committed for ${repo.name}` });
    } catch (error) {
      showToast({ type: 'error', message: `Failed to commit changes for ${repo.name}` });
    }
  };

  const handleCommitAll = async () => {
    const reposToCommit = state.repositories.filter(r => r.commitMessage && !r.error);
    
    for (const repo of reposToCommit) {
      await handleCommit(repo);
    }
  };

  if (state.isLoading) {
    return (
      <LoadingModal
        isOpen={true}
        title="Analyzing Repository Changes"
        stages={state.loadingStages}
      />
    );
  }

  if (state.error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ErrorMessage
          title="Failed to analyze repositories"
          message={state.error}
          onRetry={analyzeAllRepositories}
        />
      </div>
    );
  }

  // Debug: Show raw state for troubleshooting
  if (!state.isLoading && state.repositories.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Change Review - Debug Mode
        </h1>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
          <p className="text-yellow-800 dark:text-yellow-200">
            No repositories with changes detected. Check browser console for debug info.
          </p>
        </div>
        <button
          onClick={analyzeAllRepositories}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry Analysis
        </button>
        <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h3 className="font-bold mb-2">Current State:</h3>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(state, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Change Review
        </h1>
        
        {/* Executive Summary */}
        <div className={clsx(
          'rounded-lg p-6 mb-6',
          theme === 'dark' ? 'bg-gray-800' : 'bg-blue-50'
        )}>
          <div className="flex items-start space-x-3">
            <FileText className="h-5 w-5 text-blue-500 mt-1" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Executive Summary
              </h2>
              <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                {state.executiveSummary}
              </pre>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {state.repositories.length > 0 && (
          <div className="flex space-x-4 mb-6">
            <button
              onClick={handleCommitAll}
              className={clsx(
                'px-4 py-2 rounded-md text-white font-medium transition-colors',
                'bg-green-600 hover:bg-green-700'
              )}
            >
              Commit All Changes
            </button>
            <button
              onClick={analyzeAllRepositories}
              className={clsx(
                'px-4 py-2 rounded-md font-medium transition-colors',
                theme === 'dark'
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              )}
            >
              Refresh Analysis
            </button>
          </div>
        )}
      </div>

      {/* Repository Cards */}
      <div className="space-y-4">
        {state.repositories.map((repo) => (
          <div
            key={repo.name}
            className={clsx(
              'rounded-lg border p-6',
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {repo.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {repo.changes.length} changes
                </p>
              </div>
              {repo.error ? (
                <AlertCircle className="h-5 w-5 text-red-500" />
              ) : repo.commitMessage ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <Clock className="h-5 w-5 text-yellow-500" />
              )}
            </div>

            {/* Changes List */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Changes:
              </h4>
              <ul className="space-y-1">
                {repo.changes.slice(0, 5).map((change, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-gray-600 dark:text-gray-400 flex items-center space-x-2"
                  >
                    <span className={clsx(
                      'text-xs font-medium px-2 py-0.5 rounded',
                      change.type === 'new' && 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                      change.type === 'modified' && 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                      change.type === 'deleted' && 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    )}>
                      {change.type}
                    </span>
                    <span className="truncate">{change.path}</span>
                  </li>
                ))}
                {repo.changes.length > 5 && (
                  <li className="text-sm text-gray-500 dark:text-gray-400">
                    ... and {repo.changes.length - 5} more
                  </li>
                )}
              </ul>
            </div>

            {/* Commit Message */}
            {repo.commitMessage && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  AI-Generated Commit Message:
                </h4>
                <div className={clsx(
                  'rounded-md p-3 text-sm',
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                )}>
                  <pre className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                    {repo.commitMessage}
                  </pre>
                </div>
              </div>
            )}

            {/* Error Message */}
            {repo.error && (
              <div className="mb-4">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {repo.error}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={() => handleCommit(repo)}
                disabled={!repo.commitMessage || !!repo.error}
                className={clsx(
                  'flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  repo.commitMessage && !repo.error
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                )}
              >
                <GitCommit className="h-4 w-4" />
                <span>Commit</span>
              </button>
              <button
                className={clsx(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  theme === 'dark'
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                )}
              >
                Edit Message
              </button>
              <button
                className={clsx(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                )}
              >
                Skip
              </button>
            </div>
          </div>
        ))}
      </div>

      {state.repositories.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="text-lg text-gray-600 dark:text-gray-400">
            All repositories are clean - no uncommitted changes found.
          </p>
        </div>
      )}
    </div>
  );
};