import React, { useState, useCallback } from 'react';
import { GitCommit, Tag, RefreshCw, AlertCircle, CheckCircle, ChevronDown, ExternalLink, Activity, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { toolsDataFetcher } from '../services/toolsDataFetcher';
import { type PackageChanges, type CommitMessage } from '../services/toolsService';
import { useToastContext } from '../components/Toast';
import { ErrorMessage } from '../components/ErrorDisplay';
import { LoadingOverlay, Spinner } from '../components/LoadingStates';

interface Tool {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  isReady: boolean;
  status: 'ready' | 'running' | 'error' | 'success';
}

interface CommitResult {
  package: string;
  message: string;
  commitHash?: string;
  success: boolean;
  error?: string;
}

interface OperationResult {
  type: 'commit' | 'commit-and-push';
  timestamp: Date;
  commitResults: CommitResult[];
  pushSuccess?: boolean;
  pushError?: string;
  totalPackages: number;
  successfulPackages: number;
}

export const Tools: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning, showInfo } = useToastContext();
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [toolStatuses, setToolStatuses] = useState<Record<string, Tool['status']>>({});
  const [scannedChanges, setScannedChanges] = useState<PackageChanges[]>([]);
  const [generatedMessages, setGeneratedMessages] = useState<CommitMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [operationResult, setOperationResult] = useState<OperationResult | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [scanError, setScanError] = useState<Error | null>(null);
  const [generateError, setGenerateError] = useState<Error | null>(null);

  const tools: Tool[] = [
    {
      id: 'change-review',
      title: 'Change Review',
      description: 'Review uncommitted changes and generate commit messages with commit options',
      icon: <GitCommit className="h-6 w-6" />,
      isReady: true,
      status: toolStatuses['change-review'] || 'ready'
    },
    {
      id: 'tag-publish',
      title: 'Tag & Release',
      description: 'Create version tags and trigger package publishing workflows',
      icon: <Tag className="h-6 w-6" />,
      isReady: false, // Will implement later
      status: toolStatuses['tag-publish'] || 'ready'
    }
  ];

  // Only show ready tools in dropdown
  const availableTools = tools.filter(tool => tool.isReady);

  const handleToolSelect = (toolId: string) => {
    setSelectedTool(toolId);
    setIsDropdownOpen(false);
    // Reset errors when switching tools
    setScanError(null);
    setGenerateError(null);
  };

  const startChangeReview = useCallback(async () => {
    setIsProcessing(true);
    setToolStatuses(prev => ({ ...prev, 'change-review': 'running' }));
    setScanError(null);
    setGenerateError(null);
    
    try {
      // Show info toast about scanning
      showInfo('Scanning for changes', 'Analyzing uncommitted changes across all packages...');
      
      // Scan for changes
      const scanResult = await toolsDataFetcher.scanUncommittedChanges({
        onRetry: (attempt, error) => {
          showWarning('Retrying scan', `Attempt ${attempt}: ${error.message}`);
        }
      });
      
      if (scanResult.isError || !scanResult.data) {
        throw scanResult.error || new Error('Failed to scan changes');
      }
      
      const changes = scanResult.data;
      setScannedChanges(changes);
      
      if (changes.length > 0) {
        showInfo('Generating messages', `Found changes in ${changes.length} package(s). Generating commit messages...`);
        
        // Generate commit messages
        const messageResult = await toolsDataFetcher.generateCommitMessages(changes, {
          onRetry: (attempt, error) => {
            showWarning('Retrying message generation', `Attempt ${attempt}: ${error.message}`);
          }
        });
        
        if (messageResult.isError || !messageResult.data) {
          throw messageResult.error || new Error('Failed to generate messages');
        }
        
        setGeneratedMessages(messageResult.data);
        setToolStatuses(prev => ({ ...prev, 'change-review': 'success' }));
        showSuccess('Analysis complete', `Generated commit messages for ${messageResult.data.length} package(s)`);
      } else {
        setToolStatuses(prev => ({ ...prev, 'change-review': 'ready' }));
        showInfo('No changes found', 'All packages are up to date with no uncommitted changes');
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      setScanError(err);
      setToolStatuses(prev => ({ ...prev, 'change-review': 'error' }));
      showError('Analysis failed', err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [showInfo, showWarning, showSuccess, showError]);

  const handleCommitOnly = useCallback(async () => {
    if (generatedMessages.length === 0) return;
    
    setIsProcessing(true);
    try {
      showInfo('Committing changes', `Committing ${generatedMessages.length} package(s)...`);
      
      const result = await toolsDataFetcher.commitChanges(generatedMessages, {
        onRetry: (attempt, error) => {
          showWarning('Retrying commit', `Attempt ${attempt}: ${error.message}`);
        }
      });
      
      if (result.isError || !result.data) {
        throw result.error || new Error('Failed to commit changes');
      }
      
      // Create operation result for confirmation screen
      const commitResults: CommitResult[] = generatedMessages.map((msg) => ({
        package: msg.package,
        message: msg.message,
        success: true,
        // Real commit hashes would come from the backend
        commitHash: undefined
      }));
      
      const operationResult: OperationResult = {
        type: 'commit',
        timestamp: new Date(),
        commitResults,
        totalPackages: generatedMessages.length,
        successfulPackages: generatedMessages.length
      };
      
      setOperationResult(operationResult);
      setShowConfirmation(true);
      showSuccess('Commit successful', result.data.message);
      
      // Clear changes after successful commit
      setScannedChanges([]);
      setGeneratedMessages([]);
      setToolStatuses(prev => ({ ...prev, 'change-review': 'ready' }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      showError('Commit failed', err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [generatedMessages, showInfo, showWarning, showSuccess, showError]);

  const handleCommitAndPush = useCallback(async () => {
    if (generatedMessages.length === 0) return;
    
    setIsProcessing(true);
    try {
      showInfo('Committing and pushing', `Processing ${generatedMessages.length} package(s)...`);
      
      const result = await toolsDataFetcher.commitAndPush(generatedMessages, {
        onRetry: (attempt, error) => {
          showWarning('Retrying operation', `Attempt ${attempt}: ${error.message}`);
        }
      });
      
      if (result.isError || !result.data) {
        throw result.error || new Error('Failed to commit and push');
      }
      
      // Create operation result for confirmation screen
      const commitResults: CommitResult[] = generatedMessages.map((msg) => ({
        package: msg.package,
        message: msg.message,
        success: true,
        commitHash: undefined
      }));
      
      const operationResult: OperationResult = {
        type: 'commit-and-push',
        timestamp: new Date(),
        commitResults,
        pushSuccess: true,
        totalPackages: generatedMessages.length,
        successfulPackages: generatedMessages.length
      };
      
      setOperationResult(operationResult);
      setShowConfirmation(true);
      showSuccess('Commit and push successful', result.data.message);
      
      // Clear changes after successful commit and push
      setScannedChanges([]);
      setGeneratedMessages([]);
      setToolStatuses(prev => ({ ...prev, 'change-review': 'ready' }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      showError('Commit and push failed', err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [generatedMessages, showInfo, showWarning, showSuccess, showError]);

  const handleCloseConfirmation = () => {
    setShowConfirmation(false);
    setOperationResult(null);
  };

  const getStatusColor = (status: Tool['status']) => {
    switch (status) {
      case 'ready': return theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
      case 'running': return 'text-blue-500';
      case 'error': return 'text-red-500';
      case 'success': return 'text-green-500';
      default: return theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
    }
  };

  const getStatusIcon = (status: Tool['status']) => {
    switch (status) {
      case 'running': return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'error': return <AlertCircle className="h-4 w-4" />;
      case 'success': return <CheckCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  const selectedToolData = selectedTool ? tools.find(t => t.id === selectedTool) : null;

  return (
    <div className="space-y-6">
      {/* Loading overlay */}
      {isProcessing && (
        <LoadingOverlay
          isLoading={true}
          message="Processing changes..."
          fullScreen={true}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold">Meta GOTHIC Tools</h1>
        <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
          Powerful tools for managing your Meta GOTHIC packages
        </p>
      </div>

      {/* Tool Selection Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`
            w-full md:w-auto flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-all
            ${theme === 'dark' 
              ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' 
              : 'bg-white border-gray-200 hover:bg-gray-50'
            }
          `}
        >
          <div className="flex items-center space-x-3">
            {selectedToolData ? (
              <>
                <div className={getStatusColor(selectedToolData.status)}>
                  {selectedToolData.icon}
                </div>
                <span className="font-medium">{selectedToolData.title}</span>
                <div className={getStatusColor(selectedToolData.status)}>
                  {getStatusIcon(selectedToolData.status)}
                </div>
              </>
            ) : (
              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                Select a tool...
              </span>
            )}
          </div>
          <ChevronDown 
            className={`h-4 w-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
          />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className={`
            absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-lg z-10
            ${theme === 'dark' 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
            }
          `}>
            {availableTools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => handleToolSelect(tool.id)}
                className={`
                  w-full flex items-center space-x-3 px-4 py-3 text-left transition-colors
                  ${theme === 'dark' 
                    ? 'hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg' 
                    : 'hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg'
                  }
                  ${selectedTool === tool.id 
                    ? theme === 'dark' 
                      ? 'bg-gray-700' 
                      : 'bg-gray-50'
                    : ''
                  }
                `}
              >
                <div className={getStatusColor(tool.status)}>
                  {tool.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{tool.title}</h3>
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {tool.description}
                  </p>
                </div>
                <div className={getStatusColor(tool.status)}>
                  {getStatusIcon(tool.status)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tool-specific content */}
      {selectedTool && (
        <div className={`
          p-6 rounded-lg border
          ${theme === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
          }
        `}>
          {selectedTool === 'change-review' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Change Review</h3>
                {generatedMessages.length === 0 && !scanError && (
                  <button
                    onClick={startChangeReview}
                    disabled={isProcessing}
                    className={`
                      flex items-center space-x-2 px-4 py-2 rounded-md transition-colors
                      ${isProcessing
                        ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }
                    `}
                  >
                    <GitCommit className="h-4 w-4" />
                    <span>{isProcessing ? 'Analyzing...' : 'Start Review'}</span>
                  </button>
                )}
              </div>

              {/* Error state */}
              {scanError && (
                <ErrorMessage
                  title="Failed to analyze changes"
                  message={scanError.message}
                  severity="error"
                  onRetry={startChangeReview}
                />
              )}

              {/* Display scanned changes */}
              {scannedChanges.length > 0 && !generateError && (
                <div className="space-y-4">
                  <h4 className="font-medium">Found Changes</h4>
                  <div className="space-y-3">
                    {scannedChanges.map((pkg) => (
                      <div
                        key={pkg.package}
                        className={`p-3 rounded-lg border ${
                          theme === 'dark' 
                            ? 'bg-gray-800 border-gray-700' 
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <p className="font-medium">{pkg.package}</p>
                        <p className={`text-sm mt-1 ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {pkg.changes.length} file(s) changed: {pkg.changes.map(c => c.file).join(', ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Message generation error */}
              {generateError && (
                <ErrorMessage
                  title="Failed to generate commit messages"
                  message={generateError.message}
                  severity="error"
                  onRetry={startChangeReview}
                />
              )}

              {/* Display generated commit messages */}
              {generatedMessages.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium">Generated Commit Messages</h4>
                  <div className="space-y-3">
                    {generatedMessages.map((msg) => (
                      <div
                        key={msg.package}
                        className={`p-4 rounded-lg border ${
                          theme === 'dark' 
                            ? 'bg-gray-800 border-gray-700' 
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <p className="font-medium">{msg.package}</p>
                        <p className={`text-sm font-mono mt-2 ${
                          theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        }`}>
                          {msg.message}
                        </p>
                        {msg.description && (
                          <p className={`text-sm mt-2 ${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {msg.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Commit Options */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Ready to commit changes in {generatedMessages.length} package(s)
                    </p>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={handleCommitOnly}
                        disabled={isProcessing}
                        className={`
                          flex items-center space-x-2 px-4 py-2 rounded-md transition-colors
                          ${isProcessing
                            ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                          }
                        `}
                      >
                        <GitCommit className="h-4 w-4" />
                        <span>{isProcessing ? 'Committing...' : 'Commit'}</span>
                      </button>
                      <button
                        onClick={handleCommitAndPush}
                        disabled={isProcessing}
                        className={`
                          flex items-center space-x-2 px-4 py-2 rounded-md transition-colors
                          ${isProcessing
                            ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                          }
                        `}
                      >
                        <GitCommit className="h-4 w-4" />
                        <span>{isProcessing ? 'Committing & Pushing...' : 'Commit & Push'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* No changes message */}
              {scannedChanges.length === 0 && !isProcessing && !scanError && selectedToolData?.status === 'ready' && (
                <div className="text-center py-8">
                  <GitCommit className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                    No uncommitted changes found. Start by clicking "Start Review" to scan for changes.
                  </p>
                </div>
              )}
            </div>
          )}
          
          {selectedTool === 'tag-publish' && (
            <div className="text-center py-12">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                Tag & Release tool coming soon...
              </p>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Screen */}
      {showConfirmation && operationResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`
            max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto rounded-lg border
            ${theme === 'dark' 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
            }
          `}>
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${
                    operationResult.successfulPackages === operationResult.totalPackages && (!operationResult.pushError)
                      ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400'
                  }`}>
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {operationResult.type === 'commit' ? 'Commit' : 'Commit & Push'} Results
                    </h2>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      {operationResult.timestamp.toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseConfirmation}
                  className={`p-2 rounded-md transition-colors ${
                    theme === 'dark' 
                      ? 'hover:bg-gray-700 text-gray-400' 
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <span className="sr-only">Close</span>
                  ×
                </button>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className={`p-4 rounded-lg border ${
                  theme === 'dark' 
                    ? 'bg-gray-800 border-gray-700' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <GitCommit className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Packages Committed</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {operationResult.successfulPackages}/{operationResult.totalPackages}
                  </p>
                </div>

                {operationResult.type === 'commit-and-push' && (
                  <div className={`p-4 rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-gray-800 border-gray-700' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Push Status</span>
                    </div>
                    <p className={`text-2xl font-bold mt-1 ${
                      operationResult.pushSuccess ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {operationResult.pushSuccess ? 'Success' : 'Failed'}
                    </p>
                  </div>
                )}

                <div className={`p-4 rounded-lg border ${
                  theme === 'dark' 
                    ? 'bg-gray-800 border-gray-700' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">Status</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    Complete
                  </p>
                </div>
              </div>

              {/* Commit Results */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Commit Details</h3>
                <div className="space-y-3">
                  {operationResult.commitResults.map((result) => (
                    <div
                      key={result.package}
                      className={`p-4 rounded-lg border ${
                        result.success
                          ? theme === 'dark' 
                            ? 'bg-green-900 border-green-700' 
                            : 'bg-green-50 border-green-200'
                          : theme === 'dark' 
                            ? 'bg-red-900 border-red-700' 
                            : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{result.package}</span>
                            {result.success ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <p className={`text-sm font-mono mt-1 ${
                            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                          }`}>
                            {result.message}
                          </p>
                          {result.commitHash && (
                            <p className={`text-xs mt-1 ${
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              Commit: {result.commitHash}
                            </p>
                          )}
                          {result.error && (
                            <p className="text-xs mt-1 text-red-500">
                              Error: {result.error}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => window.location.href = '/pipelines'}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                    theme === 'dark' 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  <Activity className="h-4 w-4" />
                  <span>Monitor Pipelines</span>
                </button>
                <button
                  onClick={handleCloseConfirmation}
                  className={`px-6 py-2 rounded-md transition-colors ${
                    theme === 'dark' 
                      ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                  }`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};