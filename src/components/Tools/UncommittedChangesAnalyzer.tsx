import React, { useState, useCallback } from 'react';
import { FileText, GitCommit, ChevronRight, ChevronDown, RefreshCw, AlertCircle } from 'lucide-react';
import { useTheme } from '../../context';
import { ApiError } from '../ApiError';
import { toolsService, type PackageChanges, type ChangeItem } from '../../services/toolsService';
import { TerminalOutput } from './TerminalOutput';


interface UncommittedChangesAnalyzerProps {
  onAnalysisComplete?: (changes: PackageChanges[]) => void;
}

interface TerminalLine {
  id: string;
  timestamp: Date;
  type: 'command' | 'output' | 'error' | 'info';
  content: string;
}

export const UncommittedChangesAnalyzer: React.FC<UncommittedChangesAnalyzerProps> = ({ onAnalysisComplete }) => {
  const { theme } = useTheme();
  const [isScanning, setIsScanning] = useState(false);
  const [changes, setChanges] = useState<PackageChanges[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(new Set());
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);

  const addTerminalLine = useCallback((type: TerminalLine['type'], content: string) => {
    setTerminalLines(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      type,
      content
    }]);
  }, []);

  const scanForChanges = async () => {
    setIsScanning(true);
    setError(null);
    setChanges([]);
    setShowTerminal(true);
    setTerminalLines([]);
    
    try {
      addTerminalLine('info', 'Starting scan for uncommitted changes...');
      addTerminalLine('command', 'git status --porcelain=v1');
      
      const data = await toolsService.scanUncommittedChanges();
      
      if (data.length === 0) {
        addTerminalLine('info', 'No uncommitted changes found in any Meta GOTHIC packages');
      } else {
        addTerminalLine('output', `Found changes in ${data.length} packages:`);
        data.forEach(pkg => {
          addTerminalLine('output', `  - ${pkg.package}: ${pkg.changes.length} files changed`);
        });
      }
      
      setChanges(data);
      onAnalysisComplete?.(data);
    } catch (err) {
      addTerminalLine('error', err instanceof Error ? err.message : 'Failed to scan for changes');
      setError(err as Error);
    } finally {
      setIsScanning(false);
      addTerminalLine('info', 'Scan complete');
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

  const getStatusBadge = (status: ChangeItem['status']) => {
    const badges = {
      'M': { label: 'Modified', color: 'bg-yellow-500' },
      'A': { label: 'Added', color: 'bg-green-500' },
      'D': { label: 'Deleted', color: 'bg-red-500' },
      '??': { label: 'Untracked', color: 'bg-gray-500' }
    };

    const badge = badges[status] || { label: 'Unknown', color: 'bg-gray-500' };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  if (error) {
    return (
      <ApiError
        error={error}
        onRetry={scanForChanges}
        title="Failed to scan for changes"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Uncommitted Changes</h3>
        <button
          onClick={scanForChanges}
          disabled={isScanning}
          className={`
            flex items-center space-x-2 px-4 py-2 rounded-md transition-colors
            ${isScanning 
              ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
            }
          `}
        >
          <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Scanning...' : 'Scan for Changes'}</span>
        </button>
      </div>

      {changes.length === 0 && !isScanning && (
        <div className={`
          text-center py-12 rounded-lg border
          ${theme === 'dark' 
            ? 'bg-gray-800 border-gray-700 text-gray-400' 
            : 'bg-gray-50 border-gray-200 text-gray-600'
          }
        `}>
          <GitCommit className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No uncommitted changes found</p>
          <p className="text-sm mt-2">
            Click "Scan for Changes" to check all Meta GOTHIC packages
          </p>
        </div>
      )}

      {changes.map((pkg) => (
        <div
          key={pkg.package}
          className={`
            rounded-lg border overflow-hidden
            ${theme === 'dark' 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
            }
          `}
        >
          <button
            onClick={() => togglePackage(pkg.package)}
            className={`
              w-full px-4 py-3 flex items-center justify-between
              hover:${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}
              transition-colors
            `}
          >
            <div className="flex items-center space-x-3">
              {expandedPackages.has(pkg.package) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span className="font-medium">{pkg.package}</span>
              <span className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                ({pkg.changes.length} changes)
              </span>
            </div>
          </button>

          {expandedPackages.has(pkg.package) && (
            <div className={`
              px-4 py-3 border-t
              ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}
            `}>
              <div className="space-y-2">
                {pkg.changes.map((change, idx) => (
                  <div
                    key={idx}
                    className={`
                      flex items-center justify-between py-1
                      ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}
                    `}
                  >
                    <div className="flex items-center space-x-3">
                      <FileText className="h-4 w-4 opacity-50" />
                      <span className="text-sm font-mono">{change.file}</span>
                    </div>
                    {getStatusBadge(change.status)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {showTerminal && terminalLines.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Git Command Output
            </h4>
            <button
              onClick={() => setShowTerminal(!showTerminal)}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {showTerminal ? 'Hide' : 'Show'} Terminal
            </button>
          </div>
          <TerminalOutput 
            lines={terminalLines}
            title="Git Status Scanner"
            className="mt-2"
          />
        </div>
      )}
    </div>
  );
};