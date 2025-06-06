import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle, Loader, AlertCircle, RefreshCw, X, Settings } from 'lucide-react';
import { ProgressLog, LogEntry } from './ProgressLog';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';

export interface LoadingStage {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  message?: string;
  error?: string;
}

interface LoadingModalProps {
  isOpen: boolean;
  title: string;
  stages?: LoadingStage[];
  logEntries?: LogEntry[];
  useProgressLog?: boolean;
  onClose?: () => void;
  allowClose?: boolean;
  autoClose?: boolean;
  autoCloseDelay?: number;
  onAutoCloseChange?: (enabled: boolean) => void;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({
  isOpen,
  title,
  stages = [],
  logEntries = [],
  useProgressLog = false,
  onClose,
  allowClose = false,
  autoClose: initialAutoClose = false,
  autoCloseDelay = 3000,
  onAutoCloseChange,
}) => {
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(initialAutoClose);
  const [countdown, setCountdown] = useState<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const getStageIcon = (status: LoadingStage['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
      case 'loading':
        return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStageColor = (status: LoadingStage['status']) => {
    switch (status) {
      case 'pending':
        return 'text-gray-500';
      case 'loading':
        return 'text-blue-600 font-medium';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
    }
  };

  const allComplete = stages.every(stage => stage.status === 'success');
  const hasError = stages.some(stage => stage.status === 'error') || 
    (useProgressLog && logEntries.some(e => e.type === 'error'));
  const isComplete = useProgressLog ? 
    logEntries.some(e => e.type === 'success' && e.message.includes('complete')) :
    allComplete;
  
  // Check if commit message generation is complete (for BatchCommitMessageResult)
  const isGeneratingComplete = stages.find(s => s.id === 'generating')?.status === 'success';

  // Handle auto-close logic
  useEffect(() => {
    if (isComplete && isGeneratingComplete && autoCloseEnabled && !hasError && onClose) {
      // Add a small delay to ensure toast appears first
      setTimeout(() => {
        // Start countdown
        setCountdown(Math.ceil(autoCloseDelay / 1000));
        
        // Update countdown every second
        countdownRef.current = setInterval(() => {
          setCountdown(prev => {
            if (prev === null || prev <= 1) {
              return null;
            }
            return prev - 1;
          });
        }, 1000);
        
        // Auto close after delay
        timeoutRef.current = setTimeout(() => {
          onClose();
        }, autoCloseDelay);
      }, 100); // 100ms delay to ensure toast appears first
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      setCountdown(null);
    };
  }, [isComplete, isGeneratingComplete, autoCloseEnabled, hasError, onClose, autoCloseDelay]);

  const handleAutoCloseToggle = (enabled: boolean) => {
    setAutoCloseEnabled(enabled);
    onAutoCloseChange?.(enabled);
    
    // Cancel auto-close if disabling
    if (!enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      setCountdown(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl ${useProgressLog ? 'max-w-2xl' : 'max-w-md'} w-full mx-4`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <div className="flex items-center space-x-3">
            {isComplete ? (
              <CheckCircle className="w-8 h-8 text-green-500" />
            ) : hasError ? (
              <AlertCircle className="w-8 h-8 text-red-500" />
            ) : (
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            )}
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
          </div>
          <div className="flex items-center space-x-4">
            {/* Auto-close toggle for progress log mode */}
            {useProgressLog && isComplete && !hasError && (
              <div className="flex items-center space-x-2">
                <Label htmlFor="auto-close" className="text-sm text-gray-600 dark:text-gray-400">
                  Auto-close {countdown !== null && `(${countdown}s)`}
                </Label>
                <Switch
                  id="auto-close"
                  checked={autoCloseEnabled}
                  onCheckedChange={handleAutoCloseToggle}
                  className="scale-90"
                />
              </div>
            )}
            {allowClose && onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {useProgressLog ? (
            <ProgressLog 
              title="Scan Progress"
              entries={logEntries}
              isActive={!isComplete}
            />
          ) : (
            <div className="space-y-4">
              {stages.map((stage) => (
                <div key={stage.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getStageIcon(stage.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${getStageColor(stage.status)}`}>
                      {stage.label}
                    </div>
                    {stage.message && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {stage.message}
                      </div>
                    )}
                    {stage.error && (
                      <div className="text-xs text-red-500 mt-1">
                        {stage.error}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {(isComplete || hasError) && (
          <div className="p-6 pt-0 flex justify-end">
            <button
              onClick={onClose}
              disabled={isComplete && (!isGeneratingComplete || (countdown !== null && countdown > 0))}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isComplete && (!isGeneratingComplete || (countdown !== null && countdown > 0))
                  ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
              title={isComplete && !isGeneratingComplete ? 'Waiting for commit messages to be generated...' : ''}
            >
              {hasError ? 'Close' : 'Continue'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};