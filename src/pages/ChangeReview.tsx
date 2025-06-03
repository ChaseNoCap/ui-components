import React, { useState, useCallback, useEffect } from 'react';
import { 
  changeReviewService, 
  ChangeReviewReport, 
  ScanProgress,
  RepositoryChangeData 
} from '../services/changeReviewService';
import { graphqlChangeReviewService } from '../services/graphqlChangeReviewService';
import { graphqlParallelChangeReviewService } from '../services/graphqlParallelChangeReviewService';
import { LoadingModal } from '../components/LoadingStates/LoadingModal';
import { ErrorMessage } from '../components/ErrorDisplay/ErrorMessage';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { 
  ChevronDown, 
  ChevronRight, 
  GitCommit, 
  FileText, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Edit2,
  Send,
  RefreshCw,
  Upload,
  Zap,
  Layers
} from 'lucide-react';
import { Textarea } from '../components/ui/textarea';
import { useGitOperationCompletion } from '../hooks/useGitOperationCompletion';
import { toast } from '../lib/toast';
// import { Switch } from '../components/ui/switch'; // Unused import
import { Label } from '../components/ui/label';
import { settingsService } from '../services/settingsService';

// Feature flag for GraphQL - default to true
const USE_GRAPHQL = import.meta.env.VITE_USE_GRAPHQL !== 'false';

export const ChangeReviewPage: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [report, setReport] = useState<ChangeReviewReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());
  const [editingMessages, setEditingMessages] = useState<Map<string, string>>(new Map());
  const [committingRepos, setCommittingRepos] = useState<Set<string>>(new Set());
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [showSubmoduleChanges, setShowSubmoduleChanges] = useState<Map<string, boolean>>(new Map());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiMode, setApiMode] = useState<'rest' | 'graphql' | 'graphql-parallel'>(
    USE_GRAPHQL ? 'graphql' : 'rest'
  );
  const [logEntries, setLogEntries] = useState<Array<{
    timestamp: Date;
    message: string;
    type: 'info' | 'success' | 'error' | 'progress';
  }>>([]);
  
  // Load auto-close settings
  const modalSettings = settingsService.getModalSettings('graphqlProgress');
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(modalSettings.autoClose);
  const [autoCloseDelay] = useState(modalSettings.autoCloseDelay);

  // Select the appropriate service
  const reviewService = 
    apiMode === 'graphql-parallel' ? graphqlParallelChangeReviewService :
    apiMode === 'graphql' ? graphqlChangeReviewService : 
    changeReviewService;

  // Create a ref to store the startReview function
  const startReviewRef = React.useRef<() => Promise<void>>();

  // Use the git operation completion hook - defined after reviewService to avoid circular dependency
  const { 
    waitForCommitCompletion, 
    waitForBatchCompletion,
    getLatestCommitHash,
    isWaiting 
  } = useGitOperationCompletion({
    onComplete: () => {
      // Refresh the review when operations complete
      if (startReviewRef.current) {
        startReviewRef.current();
      }
      setIsRefreshing(false);
    },
    onError: (error) => {
      toast.error(`Git operation failed: ${error.message}`);
      setIsRefreshing(false);
    }
  });

  // Start comprehensive review
  const startReview = useCallback(async () => {
    setIsScanning(true);
    setError(null);
    setScanProgress({ stage: 'scanning', message: 'Initializing...' });
    setLogEntries([]); // Clear previous logs

    try {
      const isGraphQL = apiMode === 'graphql' || apiMode === 'graphql-parallel';
      const reviewReport = await reviewService.performComprehensiveReview(
        (progress) => setScanProgress(progress),
        isGraphQL ? (entry) => setLogEntries(prev => [...prev, entry]) : undefined
      );
      
      // Set report first
      setReport(reviewReport);
      
      // Auto-expand repos with changes
      const reposWithChanges = reviewReport.repositories
        .filter(r => r.hasChanges)
        .map(r => r.name);
      setExpandedRepos(new Set(reposWithChanges));
      
      // For REST mode, close modal after a delay
      // For GraphQL modes, let the modal handle its own closing based on auto-close settings
      if (apiMode === 'rest') {
        setTimeout(() => {
          setIsScanning(false);
          setScanProgress(null);
          toast.success('Change review completed successfully!');
        }, 500);
      } else {
        // For GraphQL modes, just show success toast
        // The modal will handle closing based on auto-close settings
        const modeText = apiMode === 'graphql-parallel' ? ' using parallel GraphQL!' : ' using GraphQL!';
        toast.success(`Change review completed successfully${modeText}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      toast.error(`Review failed: ${errorMessage}`);
      setIsScanning(false);
      setScanProgress(null);
      setIsRefreshing(false);
      // Reset the review state in case of error to allow retry
      if (apiMode === 'graphql' || apiMode === 'graphql-parallel') {
        graphqlChangeReviewService.resetReviewState();
        if (apiMode === 'graphql-parallel') {
          graphqlParallelChangeReviewService.resetReviewState();
        }
      }
    }
  }, [reviewService, apiMode]);

  // Update the ref whenever startReview changes
  React.useEffect(() => {
    startReviewRef.current = startReview;
  }, [startReview]);

  // Toggle repository expansion
  const toggleRepo = useCallback((repoName: string) => {
    setExpandedRepos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(repoName)) {
        newSet.delete(repoName);
      } else {
        newSet.add(repoName);
      }
      return newSet;
    });
  }, []);

  // Start editing a commit message
  const startEditingMessage = useCallback((repoName: string, currentMessage: string) => {
    setEditingMessages(prev => new Map(prev).set(repoName, currentMessage));
  }, []);

  // Cancel editing
  const cancelEditing = useCallback((repoName: string) => {
    setEditingMessages(prev => {
      const newMap = new Map(prev);
      newMap.delete(repoName);
      return newMap;
    });
  }, []);

  // Save edited message
  const saveEditedMessage = useCallback((repoName: string) => {
    const editedMessage = editingMessages.get(repoName);
    if (!editedMessage || !report) return;

    // Update the report with the new message
    const updatedRepos = report.repositories.map(repo => 
      repo.name === repoName 
        ? { ...repo, generatedCommitMessage: editedMessage }
        : repo
    );

    setReport({
      ...report,
      repositories: updatedRepos
    });

    cancelEditing(repoName);
    toast.success(`Updated commit message for ${repoName}`);
  }, [editingMessages, report]);

  // Commit changes for a repository
  const commitRepository = useCallback(async (repo: RepositoryChangeData, shouldPush = false) => {
    if (!repo.generatedCommitMessage) {
      toast.error('No commit message available');
      return false;
    }

    setCommittingRepos(prev => new Set(prev).add(repo.name));

    try {
      // Get the current commit hash before committing
      const previousHash = await getLatestCommitHash(repo.path);
      console.log(`[ChangeReview] Single commit - captured hash for ${repo.name}: ${previousHash}`);
      
      const result = await reviewService.commitRepository(
        repo.path,
        repo.generatedCommitMessage
      );
      
      if (result.success) {
        toast.success(`Successfully committed changes for ${repo.name}`);
        
        if (shouldPush) {
          const pushResult = await reviewService.pushRepository(repo.path);
          if (pushResult.success) {
            toast.success(`Successfully pushed ${repo.name} to origin/${pushResult.branch}`);
          } else {
            toast.error(`Failed to push ${repo.name}: ${pushResult.error || 'Unknown error'}`);
          }
        }
        
        // Wait for the commit to complete properly instead of using arbitrary delay
        setIsRefreshing(true);
        await waitForCommitCompletion(repo.path, previousHash || undefined);
        
        return true;
      } else {
        toast.error(`Failed to commit ${repo.name}: ${result.error || 'Unknown error'}`);
        return false;
      }
    } catch (err) {
      toast.error(`Failed to commit ${repo.name}: ${err}`);
      return false;
    } finally {
      setCommittingRepos(prev => {
        const newSet = new Set(prev);
        newSet.delete(repo.name);
        return newSet;
      });
    }
  }, [getLatestCommitHash, waitForCommitCompletion]);

  // Commit all repositories
  const commitAll = useCallback(async (shouldPush = false) => {
    if (!report) return;
    
    const reposToCommit = report.repositories.filter(r => r.hasChanges && r.generatedCommitMessage);
    
    if (reposToCommit.length === 0) {
      toast.error('No repositories with commit messages to commit');
      return;
    }
    
    // Set all repos as committing
    reposToCommit.forEach(repo => {
      setCommittingRepos(prev => new Set(prev).add(repo.name));
    });
    
    try {
      // Get current commit hashes before committing
      const repoHashes = await Promise.all(
        reposToCommit.map(async repo => ({
          repo,
          previousHash: await getLatestCommitHash(repo.path)
        }))
      );
      
      console.log('[ChangeReview] Captured commit hashes:', repoHashes.map(rh => ({
        repo: rh.repo.name,
        hash: rh.previousHash
      })));
      
      const commits = reposToCommit.map(repo => ({
        repoPath: repo.path,
        message: repo.generatedCommitMessage!
      }));
      
      const result = await reviewService.batchCommit(commits);
      
      // Process results
      const successfulRepos: string[] = [];
      result.results.forEach(res => {
        if (res.success) {
          toast.success(`Successfully committed ${res.repository}`);
          const repo = reposToCommit.find(r => r.name === res.repository);
          if (repo) {
            successfulRepos.push(repo.path);
          }
        } else {
          toast.error(`Failed to commit ${res.repository}: ${res.error || 'Unknown error'}`);
        }
      });
      
      // Push if requested
      if (shouldPush && successfulRepos.length > 0) {
        const pushResult = await reviewService.batchPush(successfulRepos);
        pushResult.results.forEach(res => {
          if (res.success) {
            toast.success(`Successfully pushed ${res.repository} to origin/${res.branch}`);
          } else {
            toast.error(`Failed to push ${res.repository}: ${res.error || 'Unknown error'}`);
          }
        });
      }
      
      // Refresh the report to reflect the committed changes
      if (result.results.some(res => res.success)) {
        // Wait for all successful commits to complete properly
        setIsRefreshing(true);
        const successfulCommits = result.results
          .filter(res => res.success)
          .map(res => {
            const repoHash = repoHashes.find(rh => rh.repo.name === res.repository);
            return repoHash ? { 
              path: repoHash.repo.path, 
              previousCommitHash: repoHash.previousHash ?? undefined 
            } : null;
          })
          .filter(Boolean) as Array<{ path: string; previousCommitHash?: string }>;
        
        await waitForBatchCompletion(successfulCommits);
        // The onComplete callback in the hook will handle refreshing
      }
    } catch (err) {
      toast.error(`Batch commit failed: ${err}`);
    } finally {
      // Clear all committing states
      setCommittingRepos(new Set());
    }
  }, [report, startReview, getLatestCommitHash, waitForBatchCompletion]);

  // Load data on mount
  useEffect(() => {
    if (!hasInitialLoad) {
      setHasInitialLoad(true);
      startReview();
    }
  }, [hasInitialLoad, startReview]);

  // Handle auto-close preference changes
  const handleAutoCloseChange = useCallback((enabled: boolean) => {
    setAutoCloseEnabled(enabled);
    settingsService.updateModalSettings('graphqlProgress', { autoClose: enabled });
    toast.success(`Auto-close ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'M': return <Badge variant="secondary">Modified</Badge>;
      case 'A': return <Badge variant="success">Added</Badge>;
      case 'D': return <Badge variant="destructive">Deleted</Badge>;
      case '??': return <Badge variant="outline">Untracked</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Change Review</h1>
            <p className="text-gray-600">
              Comprehensive analysis of all uncommitted changes across repositories
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* API Mode Selector */}
            <div className="flex items-center gap-2">
              <Label className="text-sm">API Mode:</Label>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={apiMode === 'rest' ? 'default' : 'outline'}
                  onClick={() => {
                    setApiMode('rest');
                    toast.info('Switched to REST API');
                  }}
                >
                  REST
                </Button>
                <Button
                  size="sm"
                  variant={apiMode === 'graphql' ? 'default' : 'outline'}
                  onClick={() => {
                    setApiMode('graphql');
                    toast.info('Switched to GraphQL API');
                  }}
                  className="flex items-center gap-1"
                >
                  <Layers className="h-3 w-3" />
                  GraphQL
                </Button>
                <Button
                  size="sm"
                  variant={apiMode === 'graphql-parallel' ? 'default' : 'outline'}
                  onClick={() => {
                    setApiMode('graphql-parallel');
                    toast.info('Switched to Parallel GraphQL API');
                  }}
                  className="flex items-center gap-1"
                >
                  <Zap className="h-3 w-3" />
                  Parallel
                </Button>
              </div>
            </div>
            {report && (
              <Button 
                onClick={startReview} 
                disabled={isScanning || isRefreshing}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${(isScanning || isRefreshing) ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons - only show if initial load has completed */}
      {!report && !isScanning && hasInitialLoad && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <Button 
              onClick={startReview} 
              disabled={isScanning}
              size="lg"
              className="w-full"
            >
              <GitCommit className="mr-2 h-5 w-5" />
              Start Comprehensive Review
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Status Indicators */}
      {isRefreshing && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Refreshing data...
        </div>
      )}
      
      {isWaiting && !isRefreshing && (
        <div className="fixed top-4 right-4 bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Verifying git operations...
        </div>
      )}

      {/* Loading Modal */}
      {isScanning && scanProgress && (
        <LoadingModal
          isOpen={true}
          title="Performing Change Review"
          useProgressLog={apiMode === 'graphql' || apiMode === 'graphql-parallel'}
          logEntries={logEntries}
          autoClose={autoCloseEnabled}
          autoCloseDelay={autoCloseDelay}
          onAutoCloseChange={handleAutoCloseChange}
          stages={[
            {
              id: 'scanning',
              label: 'Scanning Repositories',
              status: scanProgress.stage === 'scanning' ? 'loading' : 
                      scanProgress.stage === 'complete' || 
                      ['analyzing', 'generating', 'summarizing'].includes(scanProgress.stage) ? 'success' : 'pending',
              message: scanProgress.stage === 'scanning' ? scanProgress.message : undefined
            },
            {
              id: 'analyzing',
              label: 'Analyzing Changes',
              status: scanProgress.stage === 'analyzing' ? 'loading' : 
                      scanProgress.stage === 'complete' || 
                      ['generating', 'summarizing'].includes(scanProgress.stage) ? 'success' : 'pending',
              message: scanProgress.stage === 'analyzing' ? scanProgress.message : undefined
            },
            {
              id: 'generating',
              label: 'Generating Commit Messages',
              status: scanProgress.stage === 'generating' ? 'loading' : 
                      scanProgress.stage === 'complete' || 
                      scanProgress.stage === 'summarizing' ? 'success' : 'pending',
              message: scanProgress.stage === 'generating' ? scanProgress.message : undefined
            },
            {
              id: 'summarizing',
              label: 'Creating Executive Summary',
              status: scanProgress.stage === 'summarizing' ? 'loading' : 
                      scanProgress.stage === 'complete' ? 'success' : 'pending',
              message: scanProgress.stage === 'summarizing' ? scanProgress.message : undefined
            }
          ]}
          onClose={() => {
            setIsScanning(false);
            setScanProgress(null);
          }}
          allowClose={true}
        />
      )}

      {/* Error Display */}
      {error && (
        <ErrorMessage
          title="Review Failed"
          message={error}
          onRetry={startReview}
        />
      )}

      {/* Review Report */}
      {report && (
        <>
          {/* Executive Summary */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Executive Summary
              </CardTitle>
              <CardDescription>
                Generated at {new Date(report.generatedAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm">{report.executiveSummary}</div>
              
              {/* Statistics */}
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {(() => {
                      const baseCount = report.statistics?.totalFiles || 0;
                      const submoduleCount = report.repositories.reduce((sum, r) => 
                        sum + (r.statistics?.hiddenSubmoduleChanges || 0), 0);
                      return submoduleCount > 0 ? `${baseCount}+${submoduleCount}` : baseCount;
                    })()}
                  </div>
                  <div className="text-sm text-gray-600">
                    Total Files
                    {report.repositories.some(r => r.hasHiddenSubmoduleChanges) && (
                      <span className="block text-xs text-gray-500">(+submodule refs)</span>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {report.statistics?.totalAdditions || 0}
                  </div>
                  <div className="text-sm text-gray-600">Additions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {report.statistics?.totalModifications || 0}
                  </div>
                  <div className="text-sm text-gray-600">Modifications</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {report.statistics?.totalDeletions || 0}
                  </div>
                  <div className="text-sm text-gray-600">Deletions</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Batch Actions */}
          {report.repositories.some(r => r.hasChanges) && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <Button onClick={() => commitAll(false)} variant="default">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Commit All
                  </Button>
                  <Button onClick={() => commitAll(true)} variant="default">
                    <Upload className="mr-2 h-4 w-4" />
                    Commit All & Push
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Repository Cards - only show repos with changes */}
          <div className="space-y-4">
            {report.repositories.filter(repo => repo.hasChanges || repo.error).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">All repositories are clean!</h3>
                  <p className="text-gray-600">No uncommitted changes found across any repositories.</p>
                </CardContent>
              </Card>
            ) : (
              report.repositories
                .filter(repo => repo.hasChanges || repo.error)
                .map(repo => (
              <Card key={repo.name} className={repo.hasChanges ? '' : 'opacity-60'}>
                <CardHeader 
                  className="cursor-pointer"
                  onClick={() => toggleRepo(repo.name)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {expandedRepos.has(repo.name) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <CardTitle className="text-lg">{repo.name}</CardTitle>
                      <Badge variant={repo.hasChanges ? 'default' : 'secondary'}>
                        {repo.hasHiddenSubmoduleChanges && repo.statistics?.hiddenSubmoduleChanges ? 
                          `${repo.statistics.totalFiles} files (+${repo.statistics.hiddenSubmoduleChanges} submodule ref${repo.statistics.hiddenSubmoduleChanges > 1 ? 's' : ''})` :
                          `${repo.statistics?.totalFiles || 0} files`
                        }
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {repo.branch?.current || 'unknown'}
                      </span>
                      {repo.error && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                </CardHeader>

                {expandedRepos.has(repo.name) && (
                  <CardContent>
                    {/* Error message */}
                    {repo.error && (
                      <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">
                        {repo.error}
                      </div>
                    )}

                    {/* File changes */}
                    {repo.hasChanges && (
                      <>
                        <div className="mb-4">
                          <h4 className="font-semibold mb-2">Changed Files:</h4>
                          <div className="space-y-1">
                            {repo.changes.map((file, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                {getStatusBadge(file.status)}
                                <span className="font-mono">{file.file}</span>
                              </div>
                            ))}
                          </div>
                          {repo.hasHiddenSubmoduleChanges && (
                            <div className="mt-2">
                              <button
                                onClick={() => setShowSubmoduleChanges(prev => 
                                  new Map(prev).set(repo.name, !prev.get(repo.name))
                                )}
                                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                              >
                                {showSubmoduleChanges.get(repo.name) ? 'Hide' : 'Show'} submodule reference changes
                              </button>
                              {showSubmoduleChanges.get(repo.name) && repo._submoduleChanges && (
                                <div className="mt-2 pl-4 border-l-2 border-gray-300 dark:border-gray-600">
                                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    Submodule references (auto-committed):
                                  </div>
                                  {repo._submoduleChanges.map((change: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm text-gray-500">
                                      {getStatusBadge(change.status)}
                                      <span className="font-mono">{change.file}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Commit Message */}
                        <div className="mb-4">
                          <h4 className="font-semibold mb-2">Commit Message:</h4>
                          {editingMessages.has(repo.name) ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editingMessages.get(repo.name)}
                                onChange={(e) => setEditingMessages(prev => 
                                  new Map(prev).set(repo.name, e.target.value)
                                )}
                                className="font-mono text-sm"
                                rows={8}
                              />
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => saveEditedMessage(repo.name)}
                                >
                                  Save
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => cancelEditing(repo.name)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <pre className="flex-1 p-3 bg-gray-50 rounded text-sm overflow-x-auto">
                                {repo.generatedCommitMessage || 'No commit message generated'}
                              </pre>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditingMessage(
                                  repo.name, 
                                  repo.generatedCommitMessage || ''
                                )}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            onClick={() => commitRepository(repo, false)}
                            disabled={committingRepos.has(repo.name) || !repo.generatedCommitMessage}
                          >
                            {committingRepos.has(repo.name) ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                Committing...
                              </>
                            ) : (
                              <>
                                <Send className="mr-2 h-4 w-4" />
                                Commit
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => commitRepository(repo, true)}
                            disabled={committingRepos.has(repo.name) || !repo.generatedCommitMessage}
                            variant="default"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Commit & Push
                          </Button>
                          <Button variant="outline">
                            <XCircle className="mr-2 h-4 w-4" />
                            Skip
                          </Button>
                        </div>
                      </>
                    )}

                    {/* No changes message */}
                    {!repo.hasChanges && !repo.error && (
                      <p className="text-gray-600">No uncommitted changes in this repository.</p>
                    )}
                  </CardContent>
                )}
              </Card>
            )))}
          </div>
        </>
      )}
    </div>
  );
};