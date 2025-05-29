import React from 'react';
import { AlertTriangle, RefreshCw, Settings } from 'lucide-react';

interface ApiErrorProps {
  error: Error & { code?: string };
  onRetry?: () => void;
  retrying?: boolean;
  title?: string;
}

export const ApiError: React.FC<ApiErrorProps> = ({ 
  error, 
  onRetry, 
  retrying = false,
  title = "API Error"
}) => {
  const isTokenMissing = error.code === 'GITHUB_TOKEN_MISSING';
  
  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            {title}
          </h3>
          <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
            {error.message}
          </p>
          
          {isTokenMissing && (
            <div className="mt-3 p-3 bg-yellow-100 dark:bg-yellow-800/30 rounded border border-yellow-200 dark:border-yellow-600">
              <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                <Settings className="h-4 w-4 inline mr-1" />
                Quick Setup:
              </h4>
              <ol className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 list-decimal list-inside">
                <li>Create a GitHub Personal Access Token</li>
                <li>Add it to your .env.local file as VITE_GITHUB_TOKEN</li>
                <li>Restart the development server</li>
              </ol>
              <a 
                href="https://github.com/settings/tokens/new?scopes=repo,workflow,read:packages,read:org"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center mt-2 text-sm text-yellow-800 dark:text-yellow-200 hover:text-yellow-900 dark:hover:text-yellow-100 underline"
              >
                Create GitHub Token →
              </a>
            </div>
          )}
          
          {onRetry && (
            <div className="mt-3">
              <button
                onClick={onRetry}
                disabled={retrying}
                className="inline-flex items-center px-3 py-1.5 border border-yellow-300 dark:border-yellow-600 text-sm font-medium rounded text-yellow-800 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-800/20 hover:bg-yellow-200 dark:hover:bg-yellow-700/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? 'Retrying...' : 'Try Again'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};