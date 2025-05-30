import React from 'react';
import { CheckCircle, Loader, AlertCircle, RefreshCw } from 'lucide-react';

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
  stages: LoadingStage[];
  onClose?: () => void;
  allowClose?: boolean;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({
  isOpen,
  title,
  stages,
  onClose,
  allowClose = false,
}) => {
  if (!isOpen) return null;

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
  const hasError = stages.some(stage => stage.status === 'error');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            {allComplete ? (
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
          {allowClose && onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <span className="sr-only">Close</span>
              ×
            </button>
          )}
        </div>

        {/* Stages */}
        <div className="space-y-4">
          {stages.map((stage, index) => (
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

        {/* Footer */}
        {(allComplete || hasError) && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors"
            >
              {hasError ? 'Close' : 'Continue'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};