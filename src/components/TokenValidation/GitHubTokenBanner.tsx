import React from 'react';
import { AlertTriangle, ExternalLink, RefreshCw, XCircle, AlertCircle } from 'lucide-react';
import type { GitHubTokenValidationError } from '@/hooks/useGitHubToken';

interface Props {
  error: GitHubTokenValidationError;
  onRetry: () => void;
  onDismiss?: () => void;
  isRetrying?: boolean;
}

/**
 * Prominent error banner for GitHub token validation issues
 * Displays specific error messages and setup instructions
 */
export const GitHubTokenBanner: React.FC<Props> = ({ 
  error, 
  onRetry, 
  onDismiss, 
  isRetrying = false 
}) => {
  const getErrorIcon = () => {
    switch (error.type) {
      case 'missing':
        return <XCircle className="h-6 w-6 text-red-500" />;
      case 'invalid':
        return <XCircle className="h-6 w-6 text-red-500" />;
      case 'insufficient_scopes':
        return <AlertCircle className="h-6 w-6 text-yellow-500" />;
      case 'expired':
        return <AlertTriangle className="h-6 w-6 text-orange-500" />;
      case 'network_error':
        return <AlertTriangle className="h-6 w-6 text-blue-500" />;
      default:
        return <AlertTriangle className="h-6 w-6 text-gray-500" />;
    }
  };

  const getBannerStyles = () => {
    switch (error.type) {
      case 'missing':
      case 'invalid':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100';
      case 'insufficient_scopes':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100';
      case 'expired':
        return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-100';
      case 'network_error':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100';
    }
  };

  const getSetupInstructions = () => {
    switch (error.type) {
      case 'missing':
        return (
          <div className="mt-4 space-y-3">
            <p className="font-medium">Quick Setup:</p>
            <ol className="list-decimal list-inside space-y-2 text-sm ml-4">
              <li>
                Create a new GitHub Personal Access Token with <code className="bg-black/10 dark:bg-white/10 px-1 rounded">repo</code> and <code className="bg-black/10 dark:bg-white/10 px-1 rounded">workflow</code> scopes
              </li>
              <li>Copy the token and add it to your <code className="bg-black/10 dark:bg-white/10 px-1 rounded">.env</code> file as:</li>
              <li className="ml-4">
                <code className="bg-black/10 dark:bg-white/10 px-2 py-1 rounded block">
                  VITE_GITHUB_TOKEN=your_token_here
                </code>
              </li>
              <li>Restart the development server</li>
            </ol>
          </div>
        );
      case 'invalid':
        return (
          <div className="mt-4 space-y-2">
            <p className="font-medium">Token Issues:</p>
            <ul className="list-disc list-inside space-y-1 text-sm ml-4">
              <li>Check that the token was copied completely</li>
              <li>Verify the token hasn't been revoked on GitHub</li>
              <li>Make sure the token starts with <code className="bg-black/10 dark:bg-white/10 px-1 rounded">ghp_</code> or <code className="bg-black/10 dark:bg-white/10 px-1 rounded">ghs_</code></li>
            </ul>
          </div>
        );
      case 'insufficient_scopes':
        return (
          <div className="mt-4 space-y-2">
            <p className="font-medium">Required Permissions:</p>
            <ul className="list-disc list-inside space-y-1 text-sm ml-4">
              <li><code className="bg-black/10 dark:bg-white/10 px-1 rounded">repo</code> - Access to repository data</li>
              <li><code className="bg-black/10 dark:bg-white/10 px-1 rounded">workflow</code> - Trigger and manage GitHub Actions</li>
            </ul>
            <p className="text-sm">Create a new token with these scopes or update your existing token.</p>
          </div>
        );
      case 'expired':
        return (
          <div className="mt-4 space-y-2">
            <p className="font-medium">Token Status:</p>
            <p className="text-sm">Your token may be expired or rate limited. Check your GitHub token settings.</p>
          </div>
        );
      case 'network_error':
        return (
          <div className="mt-4 space-y-2">
            <p className="font-medium">Connection Issues:</p>
            <p className="text-sm">Unable to reach GitHub API. Check your internet connection and try again.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`border rounded-lg p-6 mx-4 my-4 ${getBannerStyles()}`}>
      <div className="flex items-start space-x-4">
        {getErrorIcon()}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold">
            {error.message}
          </h3>
          <p className="mt-2 text-sm opacity-90">
            {error.details}
          </p>
          
          {getSetupInstructions()}
          
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            {error.setupUrl && (
              <a
                href={error.setupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {error.type === 'missing' ? 'Create GitHub Token' : 'Update Token Permissions'}
              </a>
            )}
            
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className="inline-flex items-center justify-center px-4 py-2 border border-current text-sm font-medium rounded-md hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Checking...' : 'Check Again'}
            </button>
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-sm hover:underline focus:outline-none focus:underline transition-all"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};