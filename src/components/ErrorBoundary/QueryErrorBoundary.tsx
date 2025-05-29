import React from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { GitHubErrorBoundary, GitHubError } from './GitHubErrorBoundary';
import { ApiError } from '../ApiError';

interface QueryErrorFallbackProps {
  error: GitHubError;
  retry: () => void;
  resetErrorBoundary: () => void;
}

/**
 * Error fallback component specifically for React Query errors
 * Provides more context about query failures and retry options
 */
const QueryErrorFallback: React.FC<QueryErrorFallbackProps> = ({ 
  error, 
  retry, 
  resetErrorBoundary 
}) => {
  const handleRetry = () => {
    resetErrorBoundary();
    retry();
  };

  const getTitle = () => {
    switch (error.type) {
      case 'auth':
        return 'Authentication Required';
      case 'rate_limit':
        return 'Rate Limited';
      case 'network':
        return 'Connection Failed';
      case 'api':
        return 'API Error';
      default:
        return 'Data Loading Failed';
    }
  };

  // Convert GitHubError to a standard Error with code for ApiError component
  const apiError = new Error(error.message) as Error & { code?: string };
  apiError.code = error.type === 'auth' ? 'GITHUB_TOKEN_MISSING' : 'API_ERROR';

  return (
    <div className="p-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      <ApiError 
        error={apiError}
        onRetry={error.retryable ? handleRetry : undefined}
        title={getTitle()}
      />
    </div>
  );
};

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<QueryErrorFallbackProps>;
}

/**
 * Combined error boundary for React Query + GitHub API errors
 * Automatically resets queries when component retries
 */
export const QueryErrorBoundary: React.FC<Props> = ({ 
  children, 
  fallback: FallbackComponent = QueryErrorFallback 
}) => {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <GitHubErrorBoundary
          fallback={(error, retry) => (
            <FallbackComponent 
              error={error} 
              retry={retry}
              resetErrorBoundary={reset}
            />
          )}
        >
          {children}
        </GitHubErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
};