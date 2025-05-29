import React from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { GitHubErrorBoundary, QueryErrorBoundary, GitHubError } from './index';

// Example components that might fail
const GitHubDataComponent: React.FC = () => {
  const { data, error } = useQuery({
    queryKey: ['github-data'],
    queryFn: async () => {
      // Simulate different types of GitHub API failures
      const errorType = Math.random();
      
      if (errorType < 0.25) {
        throw new Error('GitHub token required for real API access');
      } else if (errorType < 0.5) {
        throw new Error('API rate limit exceeded');
      } else if (errorType < 0.75) {
        throw new Error('Network connection failed');
      } else {
        throw new Error('GitHub server error 500');
      }
    },
  });

  if (error) throw error;
  
  return <div>GitHub data loaded successfully!</div>;
};

const UnstableComponent: React.FC = () => {
  // Randomly throw errors to demonstrate error boundary
  if (Math.random() < 0.5) {
    throw new Error('Random component failure');
  }
  
  return <div>Component working normally</div>;
};

// Example 1: Basic app-level error boundary
export const BasicErrorBoundaryExample: React.FC = () => {
  return (
    <GitHubErrorBoundary>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">metaGOTHIC Dashboard</h1>
        <UnstableComponent />
      </div>
    </GitHubErrorBoundary>
  );
};

// Example 2: Error boundary with custom error handler
export const ErrorBoundaryWithLoggingExample: React.FC = () => {
  const handleError = (error: GitHubError) => {
    console.log('Error captured:', error);
    
    // Send to analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'github_error', {
        error_type: error.type,
        error_status: error.status,
        retryable: error.retryable,
      });
    }
  };

  return (
    <GitHubErrorBoundary onError={handleError}>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Dashboard with Error Logging</h1>
        <UnstableComponent />
      </div>
    </GitHubErrorBoundary>
  );
};

// Example 3: Custom error fallback
const CustomErrorFallback = (error: GitHubError, retry: () => void) => (
  <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">
          🚨 Custom Error Handler
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Error Type: <span className="font-mono">{error.type}</span>
        </p>
      </div>
      
      <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-400 p-4 mb-6">
        <p className="text-red-700 dark:text-red-300 font-medium">{error.message}</p>
        {error.details && (
          <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error.details}</p>
        )}
      </div>
      
      <div className="flex gap-3">
        {error.retryable && (
          <button
            onClick={retry}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Try Recovery
          </button>
        )}
        <button
          onClick={() => window.location.reload()}
          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Full Reload
        </button>
      </div>
    </div>
  </div>
);

export const CustomFallbackExample: React.FC = () => {
  return (
    <GitHubErrorBoundary fallback={CustomErrorFallback}>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Custom Error UI</h1>
        <UnstableComponent />
      </div>
    </GitHubErrorBoundary>
  );
};

// Example 4: React Query integration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
    },
  },
});

export const QueryErrorBoundaryExample: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <GitHubErrorBoundary>
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">GitHub API Integration</h1>
          
          {/* Granular error boundaries for different data sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <QueryErrorBoundary>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                <h2 className="text-lg font-semibold mb-3">Repository Data</h2>
                <GitHubDataComponent />
              </div>
            </QueryErrorBoundary>
            
            <QueryErrorBoundary>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                <h2 className="text-lg font-semibold mb-3">Workflow Status</h2>
                <GitHubDataComponent />
              </div>
            </QueryErrorBoundary>
          </div>
        </div>
      </GitHubErrorBoundary>
    </QueryClientProvider>
  );
};

// Example 5: Nested error boundaries for different failure contexts
export const NestedErrorBoundariesExample: React.FC = () => {
  return (
    <GitHubErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow p-4">
          <h1 className="text-2xl font-bold">metaGOTHIC Dashboard</h1>
        </header>
        
        <main className="container mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Health monitoring section */}
            <section>
              <h2 className="text-xl font-bold mb-4">Health Monitoring</h2>
              <QueryErrorBoundary>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
                  <GitHubDataComponent />
                </div>
              </QueryErrorBoundary>
            </section>
            
            {/* Pipeline control section */}
            <section>
              <h2 className="text-xl font-bold mb-4">Pipeline Control</h2>
              <QueryErrorBoundary>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
                  <GitHubDataComponent />
                </div>
              </QueryErrorBoundary>
            </section>
          </div>
        </main>
      </div>
    </GitHubErrorBoundary>
  );
};

// TypeScript declaration for gtag (Google Analytics)
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}