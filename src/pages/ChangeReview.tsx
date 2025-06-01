import React, { useState, useCallback, useEffect } from 'react';
import { 
  changeReviewService, 
  ChangeReviewReport, 
  ScanProgress,
  RepositoryChangeData 
} from '../services/changeReviewService';
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
import { toast } from '../lib/toast';

export const ChangeReviewPage: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [report, setReport] = useState<ChangeReviewReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());
  const [editingMessages, setEditingMessages] = useState<Map<string, string>>(new Map());
  const [committingRepos, setCommittingRepos] = useState<Set<string>>(new Set());
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  // Start comprehensive review
  const startReview = useCallback(async () => {
    setIsScanning(true);
    setError(null);
    setScanProgress({ stage: 'scanning', message: 'Initializing...' });

    try {
      const reviewReport = await changeReviewService.performComprehensiveReview(
        (progress) => setScanProgress(progress)
      );
      
      // Set report first
      setReport(reviewReport);
      
      // Auto-expand repos with changes
      const reposWithChanges = reviewReport.repositories
        .filter(r => r.hasChanges)
        .map(r => r.name);
      setExpandedRepos(new Set(reposWithChanges));
      
      // Delay closing modal to ensure DOM is fully updated
      setTimeout(() => {
        setIsScanning(false);
        setScanProgress(null);
        toast.success('Change review completed successfully!');
      }, 500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      toast.error(`Review failed: ${errorMessage}`);
      setIsScanning(false);
      setScanProgress(null);
    }
  }, []);

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
      const result = await changeReviewService.commitRepository(
        repo.path,
        repo.generatedCommitMessage
      );
      
      if (result.success) {
        toast.success(`Successfully committed changes for ${repo.name}`);
        
        if (shouldPush) {
          const pushResult = await changeReviewService.pushRepository(repo.path);
          if (pushResult.success) {
            toast.success(`Successfully pushed ${repo.name} to origin/${pushResult.branch}`);
          } else {
            toast.error(`Failed to push ${repo.name}: ${pushResult.error || 'Unknown error'}`);
          }
        }
        
        // Don't refresh immediately in batch operations
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
  }, []);

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
      const commits = reposToCommit.map(repo => ({
        repoPath: repo.path,
        message: repo.generatedCommitMessage!
      }));
      
      const result = await changeReviewService.batchCommit(commits);
      
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
        const pushResult = await changeReviewService.batchPush(successfulRepos);
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
        startReview();
      }
    } catch (err) {
      toast.error(`Batch commit failed: ${err}`);
    } finally {
      // Clear all committing states
      setCommittingRepos(new Set());
    }
  }, [report, startReview]);

  // Load data on mount
  useEffect(() => {
    if (!hasInitialLoad) {
      setHasInitialLoad(true);
      startReview();
    }
  }, [hasInitialLoad, startReview]);

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
              disabled={isScanning}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
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

      {/* Loading Modal */}
      {isScanning && scanProgress && (
        <LoadingModal
          isOpen={true}
          title="Performing Change Review"
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
          onClose={() => setIsScanning(false)}
          allowClose={false}
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
                  <div className="text-2xl font-bold">{report.statistics?.totalFiles || 0}</div>
                  <div className="text-sm text-gray-600">Total Files</div>
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
                        {repo.statistics?.totalFiles || 0} files
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
                            onClick={() => commitRepository(repo, false).then(() => startReview())}
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
                            onClick={() => commitRepository(repo, true).then(() => startReview())}
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