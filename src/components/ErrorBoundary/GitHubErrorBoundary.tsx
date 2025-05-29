import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Settings, ExternalLink } from 'lucide-react';

export interface GitHubError {
  status?: number;
  message: string;
  type: 'auth' | 'network' | 'api' | 'rate_limit' | 'unknown';
  details?: string;
  retryable: boolean;
}

interface Props {
  children: ReactNode;
  fallback?: (error: GitHubError, retry: () => void) => ReactNode;
  onError?: (error: GitHubError) => void;
}

interface State {
  hasError: boolean;
  error: GitHubError | null;
  retryCount: number;
}

/**
 * Error boundary specifically designed for GitHub API errors in metaGOTHIC dashboard
 * Provides context-aware error messages and recovery options
 */
export class GitHubErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const githubError = GitHubErrorBoundary.parseError(error);
    return {
      hasError: true,
      error: githubError,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('GitHub Error Boundary caught an error:', error, errorInfo);
    
    if (this.props.onError && this.state.error) {
      this.props.onError(this.state.error);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private static parseError(error: Error): GitHubError {
    const message = error.message.toLowerCase();
    
    // Authentication errors with enhanced detection
    if (message.includes('token') || message.includes('unauthorized') || message.includes('401') || 
        message.includes('vite_github_token') || message.includes('authentication failed')) {
      return {
        status: 401,
        message: 'GitHub authentication failed',
        type: 'auth',
        details: 'Your GitHub token is missing, invalid, or has insufficient permissions. Check your VITE_GITHUB_TOKEN environment variable.',
        retryable: false,
      };
    }
    
    // Rate limiting
    if (message.includes('rate limit') || message.includes('403')) {
      return {
        status: 403,
        message: 'GitHub API rate limit exceeded',
        type: 'rate_limit',
        details: 'API requests are temporarily limited. This will reset automatically.',
        retryable: true,
      };
    }
    
    // Network errors
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return {
        status: 0,
        message: 'Network connection failed',
        type: 'network',
        details: 'Unable to connect to GitHub API. Check your internet connection.',
        retryable: true,
      };
    }
    
    // API errors
    if (message.includes('404')) {
      return {
        status: 404,
        message: 'Resource not found',
        type: 'api',
        details: 'The requested repository or resource could not be found',
        retryable: false,
      };
    }
    
    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return {
        status: 500,
        message: 'GitHub server error',
        type: 'api',
        details: 'GitHub is experiencing server issues. Please try again later.',
        retryable: true,
      };
    }
    
    // Unknown errors
    return {
      message: error.message || 'An unexpected error occurred',
      type: 'unknown',
      details: 'An unknown error occurred while communicating with GitHub API',
      retryable: true,
    };
  }

  private handleRetry = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    const newRetryCount = this.state.retryCount + 1;
    
    // Exponential backoff for rate limiting
    const delay = this.state.error?.type === 'rate_limit' 
      ? Math.min(1000 * Math.pow(2, newRetryCount), 60000)
      : 1000;

    this.setState({ retryCount: newRetryCount });

    this.retryTimeoutId = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
      });
    }, delay);
  };

  private renderErrorMessage() {
    const { error } = this.state;
    if (!error) return null;

    const getIconColor = () => {
      switch (error.type) {
        case 'auth': return 'text-red-500';
        case 'rate_limit': return 'text-yellow-500';
        case 'network': return 'text-blue-500';
        case 'api': return 'text-orange-500';
        default: return 'text-gray-500';
      }
    };

    const getBackgroundColor = () => {
      switch (error.type) {
        case 'auth': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
        case 'rate_limit': return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
        case 'network': return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
        case 'api': return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
        default: return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
      }
    };

    return (
      <div className={`rounded-lg border p-6 ${getBackgroundColor()}`}>
        <div className="flex items-start space-x-3">
          <AlertTriangle className={`h-6 w-6 mt-0.5 ${getIconColor()}`} />
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {error.message}
            </h3>
            {error.details && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {error.details}
              </p>
            )}
            {error.status && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Status Code: {error.status}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  private renderAuthHelp() {
    const { error } = this.state;
    if (error?.type !== 'auth') return null;

    return (
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          GitHub Token Setup Required
        </h4>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <p>To use the metaGOTHIC dashboard, you need a GitHub Personal Access Token:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Go to GitHub Settings → Developer settings → Personal access tokens</li>
            <li>Generate a new token with these scopes: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">repo</code>, <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">workflow</code></li>
            <li>Copy the token and add it to your environment as <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">VITE_GITHUB_TOKEN</code></li>
            <li>Restart the development server</li>
          </ol>
          <a
            href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=metaGOTHIC%20Dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Create GitHub Token</span>
          </a>
        </div>
      </div>
    );
  }

  private renderActions() {
    const { error } = this.state;
    if (!error) return null;

    return (
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        {error.retryable && (
          <button
            onClick={this.handleRetry}
            disabled={this.retryTimeoutId !== null}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${this.retryTimeoutId ? 'animate-spin' : ''}`} />
            {this.retryTimeoutId ? 'Retrying...' : 'Retry'}
          </button>
        )}
        
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Settings className="h-4 w-4 mr-2" />
          Reload Page
        </button>
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback && this.state.error) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                metaGOTHIC Dashboard Error
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Something went wrong while loading the dashboard
              </p>
            </div>
            
            {this.renderErrorMessage()}
            {this.renderAuthHelp()}
            {this.renderActions()}
            
            {this.state.retryCount > 0 && (
              <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
                Retry attempt: {this.state.retryCount}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}