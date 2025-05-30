import React, { useState } from 'react';
import { GitCommit, Tag, RefreshCw, AlertCircle, CheckCircle, ChevronDown, ExternalLink, Activity, Clock } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { toolsService, type PackageChanges, type CommitMessage } from '../services/toolsService';

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
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [toolStatuses, setToolStatuses] = useState<Record<string, Tool['status']>>({});
  const [scannedChanges, setScannedChanges] = useState<PackageChanges[]>([]);
  const [generatedMessages, setGeneratedMessages] = useState<CommitMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [operationResult, setOperationResult] = useState<OperationResult | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const tools: Tool[] = [
    {
      id: 'change-review',
      title: 'Change Review',
      description: 'Automatically get current changes and generate AI messages for review with commit options',
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
  };

  const startChangeReview = async () => {
    setIsProcessing(true);
    setToolStatuses(prev => ({ ...prev, 'change-review': 'running' }));
    
    try {
      // Automatically scan for changes
      const changes = await toolsService.scanUncommittedChanges();
      setScannedChanges(changes);
      
      if (changes.length > 0) {
        // Automatically generate commit messages
        const messages = await toolsService.generateCommitMessages(changes);
        setGeneratedMessages(messages);
        setToolStatuses(prev => ({ ...prev, 'change-review': 'success' }));
      } else {
        setToolStatuses(prev => ({ ...prev, 'change-review': 'ready' }));
      }
    } catch (error) {
      setToolStatuses(prev => ({ ...prev, 'change-review': 'error' }));
      console.error('Failed to analyze changes:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommitOnly = async () => {
    if (generatedMessages.length === 0) return;
    
    setIsProcessing(true);
    try {
      await toolsService.commitChanges(generatedMessages);
      
      // Generate mock commit results for demonstration
      const commitResults: CommitResult[] = generatedMessages.map((msg, index) => ({
        package: msg.package,
        message: msg.message,
        commitHash: `abc${Math.random().toString(36).substr(2, 6)}`, // Mock hash
        success: Math.random() > 0.1, // 90% success rate for demo
        error: Math.random() > 0.9 ? 'Mock commit error for demo' : undefined
      }));
      
      const result: OperationResult = {
        type: 'commit',
        timestamp: new Date(),
        commitResults,
        totalPackages: generatedMessages.length,
        successfulPackages: commitResults.filter(r => r.success).length
      };
      
      setOperationResult(result);
      setShowConfirmation(true);
      
      // Clear changes after successful commit
      setScannedChanges([]);
      setGeneratedMessages([]);
      setToolStatuses(prev => ({ ...prev, 'change-review': 'ready' }));
    } catch (error) {
      console.error('Failed to commit changes:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommitAndPush = async () => {
    if (generatedMessages.length === 0) return;
    
    setIsProcessing(true);
    try {
      await toolsService.commitChanges(generatedMessages);
      await toolsService.pushAllRepositories();
      
      // Generate mock commit and push results for demonstration
      const commitResults: CommitResult[] = generatedMessages.map((msg, index) => ({
        package: msg.package,
        message: msg.message,
        commitHash: `def${Math.random().toString(36).substr(2, 6)}`, // Mock hash
        success: Math.random() > 0.1, // 90% success rate for demo
        error: Math.random() > 0.9 ? 'Mock commit error for demo' : undefined
      }));
      
      const result: OperationResult = {
        type: 'commit-and-push',
        timestamp: new Date(),
        commitResults,
        pushSuccess: Math.random() > 0.15, // 85% push success rate for demo
        pushError: Math.random() > 0.85 ? 'Mock push error for demo' : undefined,
        totalPackages: generatedMessages.length,
        successfulPackages: commitResults.filter(r => r.success).length
      };
      
      setOperationResult(result);
      setShowConfirmation(true);
      
      // Clear changes after successful commit and push
      setScannedChanges([]);
      setGeneratedMessages([]);
      setToolStatuses(prev => ({ ...prev, 'change-review': 'ready' }));
    } catch (error) {
      console.error('Failed to commit and push changes:', error);
    } finally {
      setIsProcessing(false);
    }
  };

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
                {generatedMessages.length === 0 && (
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

              {/* Display scanned changes */}
              {scannedChanges.length > 0 && (
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
              {scannedChanges.length === 0 && !isProcessing && selectedToolData?.status === 'ready' && (
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
                  <AlertCircle className="h-5 w-5 rotate-45" />
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
                    <Clock className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">Duration</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {Math.floor(Math.random() * 45) + 5}s
                  </p>
                </div>
              </div>

              {/* Commit Results */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Commit Details</h3>
                <div className="space-y-3">
                  {operationResult.commitResults.map((result, index) => (
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

              {/* CI/CD Monitoring Placeholders */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3">CI/CD Pipeline Status</h3>
                <div className={`p-4 rounded-lg border ${
                  theme === 'dark' 
                    ? 'bg-gray-800 border-gray-700' 
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center space-x-2 mb-3">
                    <Activity className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Pipeline Monitoring</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      theme === 'dark' 
                        ? 'bg-blue-900 text-blue-400' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      Coming Soon
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        GitHub Actions workflows will be tracked here
                      </span>
                      <button className={`flex items-center space-x-1 text-blue-500 hover:text-blue-600 text-sm`}>
                        <ExternalLink className="h-3 w-3" />
                        <span>View on GitHub</span>
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        Real-time build status and test results
                      </span>
                      <button className={`flex items-center space-x-1 text-blue-500 hover:text-blue-600 text-sm`}>
                        <Activity className="h-3 w-3" />
                        <span>Live Status</span>
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        Package publishing progress
                      </span>
                      <button className={`flex items-center space-x-1 text-blue-500 hover:text-blue-600 text-sm`}>
                        <ExternalLink className="h-3 w-3" />
                        <span>NPM Registry</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => window.open('/pipelines', '_blank')}
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