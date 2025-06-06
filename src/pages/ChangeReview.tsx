import React, { useState, useCallback, useEffect } from 'react';
import { 
  ChangeReviewReport, 
  ScanProgress,
  RepositoryChangeData 
} from '../services/changeReviewService';
import { graphqlChangeReviewService } from '../services/graphqlChangeReviewService';
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
  Upload
} from 'lucide-react';
import { Textarea } from '../components/ui/textarea';
import { useGitOperationManager } from '../hooks/useGitOperationManager';
import { toast } from '../lib/toast';
import { settingsService } from '../services/settingsService';

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
  const [logEntries, setLogEntries] = useState<Array<{
    timestamp: Date;
    message: string;
    type: 'info' | 'success' | 'error' | 'progress';
  }>>([]);
  
  // Load auto-close settings
  const modalSettings = settingsService.getModalSettings('graphqlProgress');
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(modalSettings.autoClose);
  const [autoCloseDelay] = useState(modalSettings.autoCloseDelay);

  // Use the GraphQL service
  const reviewService = graphqlChangeReviewService;

  // Create a ref to store the startReview function
  const startReviewRef = React.useRef<() => Promise<void>>();

  // Use the git operation manager for sequential execution
  const {
    isProcessing: isWaiting,
    executeOperations,
    createCommitOperation,
    createPushOperation,
    getLatestCommitHash,
    progress: operationProgress
  } = useGitOperationManager({
    showToasts: false // We'll handle toasts ourselves
  });

  // Start comprehensive review
  const startReview = useCallback(async () => {
    // Reset review state to allow refresh
    reviewService.resetReviewState();
    
    setIsScanning(true);
    setError(null);
    setScanProgress({ stage: 'scanning', message: 'Initializing...' });
    setLogEntries([]); // Clear previous logs

    try {
      const reviewReport = await reviewService.performComprehensiveReview(
        (progress) => setScanProgress(progress),
        (entry) => setLogEntries(prev => [...prev, entry])
      );
      
      // Set report first
      setReport(reviewReport);
      
      // Auto-expand repos with changes
      const reposWithChanges = reviewReport.repositories
        .filter(r => r.hasChanges)
        .map(r => r.name);
      setExpandedRepos(new Set(reposWithChanges));
      
      // Show success toast
      // The modal will handle closing based on auto-close settings
      toast.success('Change review completed successfully!');
      
      // Clear scanning state on success
      setIsScanning(false);
      setScanProgress(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      toast.error(`Review failed: ${errorMessage}`);
      setIsScanning(false);
      setScanProgress(null);
      setIsRefreshing(false);
      // Reset the review state in case of error to allow retry
      graphqlChangeReviewService.resetReviewState();
    }
  }, [reviewService]);

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
    setIsRefreshing(true);

    try {
      // Get the current commit hash before committing
      const previousHash = await getLatestCommitHash(repo.path);
      console.log(`[ChangeReview] Single commit - captured hash for ${repo.name}: ${previousHash}`);
      
      const operations = [];
      
      // Create commit operation
      const commitOp = createCommitOperation(
        `commit-${repo.name}`,
        repo.name,
        () => reviewService.commitRepository(repo.path, repo.generatedCommitMessage!),
        previousHash
      );
      operations.push(commitOp);
      
      // Add push operation if requested
      if (shouldPush) {
        const pushOp = createPushOperation(
          `push-${repo.name}`,
          repo.name,
          () => reviewService.pushRepository(repo.path)
        );
        operations.push(pushOp);
      }
      
      // Execute operations sequentially
      const results = await executeOperations(operations);
      
      // Check results
      const commitResult = results[0];
      if (commitResult && commitResult.success) {
        toast.success(`Successfully committed changes for ${repo.name}`);
        
        if (shouldPush && results[1]) {
          if (results[1].success) {
            const pushData = results[1].result;
            toast.success(`Successfully pushed ${repo.name} to origin/${pushData.branch}`);
          } else {
            toast.error(`Failed to push ${repo.name}: ${results[1].error?.message || 'Unknown error'}`);
          }
        }
        
        return true;
      } else {
        toast.error(`Failed to commit ${repo.name}: ${commitResult?.error?.message || 'Unknown error'}`);
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
  }, [getLatestCommitHash, createCommitOperation, createPushOperation, executeOperations, reviewService]);

  // Commit all repositories
  const commitAll = useCallback(async (shouldPush = false) => {
    if (!report) return;
    
    const reposToCommit = report.repositories.filter(r => r.hasChanges && r.generatedCommitMessage);
    
    console.log('[ChangeReview] commitAll called:', {
      shouldPush,
      reposToCommit: reposToCommit.map(r => ({ name: r.name, path: r.path, hasMessage: !!r.generatedCommitMessage })),
      totalRepos: reposToCommit.length
    });
    
    if (reposToCommit.length === 0) {
      toast.error('No repositories with commit messages to commit');
      return;
    }
    
    // Set all repos as committing
    reposToCommit.forEach(repo => {
      setCommittingRepos(prev => new Set(prev).add(repo.name));
    });
    setIsRefreshing(true);
    
    try {
      // Use a common commit message (from the first non-submodule repo or fallback)
      const parentRepo = reposToCommit.find(r => !r.path.includes('packages/'));
      const commonMessage = parentRepo?.generatedCommitMessage || reposToCommit[0]?.generatedCommitMessage || 'Update multiple repositories';
      
      console.log('[ChangeReview] Using commit message:', commonMessage);
      
      if (shouldPush) {
        // Use hierarchical commit and push for proper ordering
        console.log('[ChangeReview] Attempting hierarchicalCommitAndPush...');
        const hasMethod = typeof (reviewService as any).hierarchicalCommitAndPush === 'function';
        console.log('[ChangeReview] hierarchicalCommitAndPush available:', hasMethod);
        
        const result = await (reviewService as any).hierarchicalCommitAndPush?.(commonMessage);
        
        console.log('[ChangeReview] hierarchicalCommitAndPush result:', result);
        
        if (result) {
          // Process commit results
          if (result.commitResult) {
            const commitResult = result.commitResult;
            if (commitResult.success) {
              toast.success(`Successfully committed ${commitResult.successCount}/${commitResult.totalRepositories} repositories`);
            } else {
              toast.error(`Commit partially failed: ${commitResult.error || 'Unknown error'}`);
            }
            
            // Show individual commit results
            commitResult.submoduleCommits?.forEach((commit: any) => {
              if (commit.success) {
                console.log(`✓ Committed ${commit.repository}`);
              } else {
                console.error(`✗ Failed ${commit.repository}: ${commit.error}`);
              }
            });
            
            if (commitResult.parentCommit?.success) {
              console.log(`✓ Committed meta-gothic-framework`);
            }
          }
          
          // Process push results
          if (result.pushResults) {
            result.pushResults.forEach((push: any) => {
              if (push.success) {
                toast.success(`Successfully pushed ${push.repository}`);
              } else {
                toast.error(`Failed to push ${push.repository}: ${push.error || 'Unknown error'}`);
              }
            });
          }
        } else {
          // Fallback to sequential commit using GitOperationManager
          await commitAllSequentially(shouldPush);
        }
      } else {
        // Just commit without push - use sequential approach
        await commitAllSequentially(false);
      }
    } catch (err) {
      toast.error(`Commit operation failed: ${err}`);
    } finally {
      // Clear all committing states
      setCommittingRepos(new Set());
    }
    
    // Helper function for sequential commit
    async function commitAllSequentially(push: boolean) {
      console.log('[ChangeReview] Starting sequential commit process');
      
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
        
        // PHASE 1: Commit all repositories sequentially
        const commitOperations = [];
        for (const { repo, previousHash } of repoHashes) {
          const commitOp = createCommitOperation(
            `commit-${repo.name}`,
            repo.name,
            () => {
              console.log(`[ChangeReview] Executing commit for ${repo.name}`);
              return reviewService.commitRepository(repo.path, repo.generatedCommitMessage!);
            },
            previousHash
          );
          commitOperations.push(commitOp);
        }
        
        console.log(`[ChangeReview] Executing ${commitOperations.length} commit operations sequentially`);
        const commitResults = await executeOperations(commitOperations);
        
        // Check commit results
        const successfulCommits = commitResults.filter(r => r.success);
        const failedCommits = commitResults.filter(r => !r.success);
        
        console.log(`[ChangeReview] Commit results: ${successfulCommits.length} successful, ${failedCommits.length} failed`);
        
        if (failedCommits.length > 0) {
          // Log details of failed commits
          failedCommits.forEach(result => {
            console.error(`[ChangeReview] Commit failed for ${result.id}:`, result.error);
          });
          
          toast.error(`${failedCommits.length} repositories failed to commit. Check console for details.`);
          
          // Don't proceed to push if any commits failed
          if (push) {
            toast.warning('Skipping push due to commit failures');
          }
          return;
        }
        
        toast.success(`All ${successfulCommits.length} repositories committed successfully`);
        
        // PHASE 2: Push ALL repositories (not just the ones we committed)
        if (push) {
          console.log('[ChangeReview] All commits successful, proceeding with push phase');
          
          // Get ALL repositories from the report to check if any need pushing
          const allRepos = report?.repositories || [];
          const pushOperations = [];
          
          // Create push operations for all repos
          for (const repo of allRepos) {
            const pushOp = createPushOperation(
              `push-${repo.name}`,
              repo.name,
              () => {
                console.log(`[ChangeReview] Executing push for ${repo.name}`);
                return reviewService.pushRepository(repo.path);
              }
            );
            pushOperations.push(pushOp);
          }
          
          console.log(`[ChangeReview] Executing ${pushOperations.length} push operations sequentially`);
          const pushResults = await executeOperations(pushOperations);
          
          // Check push results
          const successfulPushes = pushResults.filter(r => r.success);
          const failedPushes = pushResults.filter(r => !r.success);
          
          console.log(`[ChangeReview] Push results: ${successfulPushes.length} successful, ${failedPushes.length} failed`);
          
          if (failedPushes.length > 0) {
            // Log details of failed pushes
            failedPushes.forEach(result => {
              console.error(`[ChangeReview] Push failed for ${result.id}:`, result.error);
            });
            
            toast.warning(`${successfulPushes.length} repositories pushed, ${failedPushes.length} failed`);
          } else {
            toast.success(`All ${successfulPushes.length} repositories pushed successfully`);
          }
        }
      } finally {
        // Always refresh after operations complete
        console.log('[ChangeReview] Operations complete, refreshing data...');
        setIsRefreshing(true);
        
        // Wait a moment for git operations to settle
        setTimeout(() => {
          if (startReviewRef.current) {
            startReviewRef.current();
          }
        }, 1000);
      }
    }
  }, [report, reviewService, getLatestCommitHash, createCommitOperation, createPushOperation, executeOperations]);

  // Push all repositories that are ahead
  const pushAll = useCallback(async () => {
    if (!report) return;
    
    const reposToPush = report.repositories.filter(r => r.branch?.ahead > 0);
    
    if (reposToPush.length === 0) {
      toast.info('No repositories need pushing');
      return;
    }
    
    // Set refreshing state
    setIsRefreshing(true);
    
    try {
      console.log('[ChangeReview] Starting push all process');
      
      // Create push operations for all repos that are ahead
      const pushOperations = [];
      for (const repo of reposToPush) {
        const pushOp = createPushOperation(
          `push-${repo.name}`,
          repo.name,
          () => {
            console.log(`[ChangeReview] Executing push for ${repo.name}`);
            return reviewService.pushRepository(repo.path);
          }
        );
        pushOperations.push(pushOp);
      }
      
      console.log(`[ChangeReview] Executing ${pushOperations.length} push operations sequentially`);
      const pushResults = await executeOperations(pushOperations);
      
      // Check push results
      const successfulPushes = pushResults.filter(r => r.success);
      const failedPushes = pushResults.filter(r => !r.success);
      
      console.log(`[ChangeReview] Push results: ${successfulPushes.length} successful, ${failedPushes.length} failed`);
      
      if (failedPushes.length > 0) {
        // Log details of failed pushes
        failedPushes.forEach(result => {
          console.error(`[ChangeReview] Push failed for ${result.id}:`, result.error);
        });
        
        toast.warning(`${successfulPushes.length} repositories pushed, ${failedPushes.length} failed`);
      } else {
        toast.success(`All ${successfulPushes.length} repositories pushed successfully`);
      }
    } catch (err) {
      toast.error(`Push operation failed: ${err}`);
    } finally {
      // Always refresh after operations complete
      console.log('[ChangeReview] Push operations complete, refreshing data...');
      setIsRefreshing(true);
      
      // Wait a moment for git operations to settle
      setTimeout(() => {
        if (startReviewRef.current) {
          startReviewRef.current();
        }
      }, 1000);
    }
  }, [report, reviewService, createPushOperation, executeOperations]);

  // Load data on mount - use empty dependency array to ensure it only runs once
  useEffect(() => {
    if (!hasInitialLoad) {
      setHasInitialLoad(true);
      // Delay slightly to ensure all state is initialized
      setTimeout(() => {
        startReview();
      }, 100);
    }
  }, []); // Empty dependency array - only run on mount

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
          {operationProgress.total > 0 
            ? `Git operations: ${operationProgress.completed}/${operationProgress.total}`
            : 'Processing git operations...'}
        </div>
      )}

      {/* Loading Modal */}
      {isScanning && scanProgress && (
        <LoadingModal
          isOpen={true}
          title="Performing Change Review"
          useProgressLog={true}
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
                      ['analyzing', 'generating'].includes(scanProgress.stage) ? 'success' : 'pending',
              message: scanProgress.stage === 'scanning' ? scanProgress.message : ''
            },
            {
              id: 'analyzing',
              label: 'Analyzing Changes',
              status: scanProgress.stage === 'analyzing' ? 'loading' : 
                      scanProgress.stage === 'complete' || 
                      ['generating'].includes(scanProgress.stage) ? 'success' : 'pending',
              message: scanProgress.stage === 'analyzing' ? scanProgress.message : ''
            },
            {
              id: 'generating',
              label: 'Generating Commit Messages',
              status: scanProgress.stage === 'generating' ? 'loading' : 
                      scanProgress.stage === 'complete' ? 'success' : 'pending',
              message: scanProgress.stage === 'generating' ? scanProgress.message : ''
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
          {/* Statistics */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Repository Statistics
              </CardTitle>
              <CardDescription>
                Generated at {new Date(report.generatedAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
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
          {(report.repositories.some(r => r.hasChanges) || report.repositories.some(r => r.branch?.ahead > 0)) && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  {report.repositories.some(r => r.hasChanges) && (
                    <>
                      <Button onClick={() => commitAll(false)} variant="default">
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Commit All
                      </Button>
                      <Button onClick={() => commitAll(true)} variant="default">
                        <Upload className="mr-2 h-4 w-4" />
                        Commit All & Push
                      </Button>
                    </>
                  )}
                  {!report.repositories.some(r => r.hasChanges) && report.repositories.some(r => r.branch?.ahead > 0) && (
                    <Button onClick={() => pushAll()} variant="default">
                      <Upload className="mr-2 h-4 w-4" />
                      Push All
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Repository Cards - show repos with changes or that need pushing */}
          <div className="space-y-4">
            {report.repositories.filter(repo => repo.hasChanges || repo.error || repo.branch?.ahead > 0).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">All repositories are up to date!</h3>
                  <p className="text-gray-600">No uncommitted changes or unpushed commits found.</p>
                </CardContent>
              </Card>
            ) : (
              report.repositories
                .filter(repo => repo.hasChanges || repo.error || repo.branch?.ahead > 0)
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
                      {repo.branch?.ahead > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Upload className="h-3 w-3 mr-1" />
                          {repo.branch.ahead} ahead
                        </Badge>
                      )}
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