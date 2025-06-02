import React, { useState, useCallback, useEffect } from 'react';
import { FileText, GitCommit, ChevronRight, ChevronDown, RefreshCw, AlertCircle } from 'lucide-react';
import { useTheme } from '../../context';
import { ApiError } from '../ApiError';
import { useScanAllDetailed } from '../../hooks/useGraphQL';
import { TerminalOutput } from './TerminalOutput';
import { api } from '../../services/api-adapter';

interface UncommittedChangesAnalyzerProps {
  onAnalysisComplete?: (changes: PackageChanges[]) => void;
}

interface PackageChanges {
  package: string;
  path: string;
  changes: ChangeItem[];
}

interface ChangeItem {
  file: string;
  status: string;
  staged: boolean;
}

interface TerminalLine {
  id: string;
  timestamp: Date;
  type: 'command' | 'output' | 'error' | 'info';
  content: string;
}

export const UncommittedChangesAnalyzer: React.FC<UncommittedChangesAnalyzerProps> = ({ onAnalysisComplete }) => {
  const { theme } = useTheme();
  const [changes, setChanges] = useState<PackageChanges[]>([]);
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(new Set());
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  
  // Use GraphQL hook
  const { loading: isScanning, error, data, refetch } = useScanAllDetailed();

  const addTerminalLine = useCallback((type: TerminalLine['type'], content: string) => {
    setTerminalLines(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      type,
      content
    }]);
  }, []);

  // Process GraphQL data when it arrives
  useEffect(() => {
    if (data?.scanAllDetailed?.repositories) {
      const processedChanges: PackageChanges[] = [];
      
      data.scanAllDetailed.repositories.forEach((repo: any) => {
        if (repo.gitStatus?.files?.length > 0) {
          processedChanges.push({
            package: repo.name,
            path: repo.path,
            changes: repo.gitStatus.files.map((file: any) => ({
              file: file.path,
              status: file.status,
              staged: file.staged || false,
            })),
          });
        }
      });

      setChanges(processedChanges);
      onAnalysisComplete?.(processedChanges);

      // Update terminal output
      if (processedChanges.length === 0) {
        addTerminalLine('info', 'No uncommitted changes found in any Meta GOTHIC packages');
      } else {
        addTerminalLine('output', `Found changes in ${processedChanges.length} packages:`);
        processedChanges.forEach(pkg => {
          addTerminalLine('output', `  - ${pkg.package}: ${pkg.changes.length} files changed`);
        });
      }
    }
  }, [data, addTerminalLine, onAnalysisComplete]);

  const scanForChanges = async () => {
    setChanges([]);
    setShowTerminal(true);
    setTerminalLines([]);
    
    addTerminalLine('info', 'Starting scan for uncommitted changes...');
    addTerminalLine('command', 'query scanAllDetailed');
    
    try {
      await refetch();
      addTerminalLine('info', 'Scan complete');
    } catch (err) {
      addTerminalLine('error', err instanceof Error ? err.message : 'Failed to scan for changes');
    }
  };

  const togglePackage = (packageName: string) => {
    setExpandedPackages(prev => {
      const next = new Set(prev);
      if (next.has(packageName)) {
        next.delete(packageName);
      } else {
        next.add(packageName);
      }
      return next;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'M': return 'text-yellow-600 dark:text-yellow-400';
      case 'A': return 'text-green-600 dark:text-green-400';
      case 'D': return 'text-red-600 dark:text-red-400';
      case 'R': return 'text-blue-600 dark:text-blue-400';
      case 'C': return 'text-purple-600 dark:text-purple-400';
      case 'U': return 'text-orange-600 dark:text-orange-400';
      case '?': return 'text-gray-600 dark:text-gray-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'M': return 'Modified';
      case 'A': return 'Added';
      case 'D': return 'Deleted';
      case 'R': return 'Renamed';
      case 'C': return 'Copied';
      case 'U': return 'Updated';
      case '?': return 'Untracked';
      default: return status;
    }
  };

  const isDarkMode = theme === 'dark';
  const apiMode = api.mode.get();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Uncommitted Changes Analyzer
          </h3>
          <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
            {apiMode === 'graphql' ? 'GraphQL' : 'REST'}
          </span>
        </div>
        <button
          onClick={scanForChanges}
          disabled={isScanning}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Scanning...' : 'Scan for Changes'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-900 dark:text-red-100">Error scanning for changes</h4>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error.message}</p>
            </div>
          </div>
        </div>
      )}

      {showTerminal && (
        <TerminalOutput lines={terminalLines} className="h-48" />
      )}

      {changes.length > 0 && (
        <div className="space-y-3">
          {changes.map((pkg) => (
            <div
              key={pkg.package}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => togglePackage(pkg.package)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedPackages.has(pkg.package) ? (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  )}
                  <GitCommit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {pkg.package}
                  </span>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {pkg.changes.length} {pkg.changes.length === 1 ? 'file' : 'files'} changed
                </span>
              </button>

              {expandedPackages.has(pkg.package) && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <div className="p-4 space-y-2">
                    {pkg.changes.map((change, idx) => (
                      <div
                        key={`${change.file}-${idx}`}
                        className="flex items-center gap-3 text-sm"
                      >
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className={`font-mono ${getStatusColor(change.status)}`}>
                          {change.status}
                        </span>
                        <span className="text-gray-700 dark:text-gray-300 font-mono">
                          {change.file}
                        </span>
                        <span className={`text-xs ${getStatusColor(change.status)}`}>
                          ({getStatusLabel(change.status)})
                        </span>
                        {change.staged && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                            Staged
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!isScanning && changes.length === 0 && !error && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <GitCommit className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Click "Scan for Changes" to analyze uncommitted files</p>
        </div>
      )}
    </div>
  );
};