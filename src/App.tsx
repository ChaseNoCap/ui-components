import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { HealthDashboard } from './components/HealthDashboard';
import { PipelineControl } from './components/PipelineControl';
import { Tools } from './pages/Tools';
import { ChangeReviewPage } from './pages/ChangeReview';
import { RepositoryStatusPage } from './pages/RepositoryStatus';
import { ManualCommitPage } from './pages/ManualCommit';
import { GitHubErrorBoundary } from './components/ErrorBoundary';
import { ClaudeConsoleStandalone } from './pages/ClaudeConsoleStandalone';
import { GitHubTokenBanner } from './components/TokenValidation';
import { Navigation } from './components/Navigation';
import { TokenValidationProvider, useTokenValidation } from './contexts';
import { ThemeProvider } from './context';
import { ToastProvider } from './components/Toast';
import { GraphQLProvider } from './providers/GraphQLProvider';
import Config from './pages/Config';
import AgentStatus from './pages/AgentStatus';
import { GraphQLDebug } from './components/GraphQLDebug';
import './utils/test-graphql'; // Load test utilities

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
    },
  },
});

const DashboardContent: React.FC = () => {
  const { error, isValidating, retryValidation, dismissError, isDismissed } = useTokenValidation();
  
  const shouldShowBanner = error && !isDismissed;

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+, or Ctrl+, to open config
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault();
        window.location.href = '/config';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />
      
      {/* Token validation banner */}
      {shouldShowBanner && (
        <GitHubTokenBanner 
          error={error}
          onRetry={retryValidation}
          onDismiss={dismissError}
          isRetrying={isValidating}
        />
      )}
      
      <Routes>
        <Route path="/" element={<HealthDashboard />} />
        <Route path="/pipelines" element={<PipelineControl />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/tools/change-review" element={<ChangeReviewPage />} />
        <Route path="/tools/repository-status" element={<RepositoryStatusPage />} />
        <Route path="/tools/manual-commit" element={<ManualCommitPage />} />
        <Route path="/config" element={<Config />} />
        <Route path="/agent-status" element={<AgentStatus />} />
        <Route path="/claude-console" element={<ClaudeConsoleStandalone />} />
      </Routes>
      <GraphQLDebug />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <GitHubErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <GraphQLProvider>
            <TokenValidationProvider>
              <ToastProvider position="top-right">
                <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
                  <DashboardContent />
                  <ReactQueryDevtools initialIsOpen={false} />
                </Router>
              </ToastProvider>
            </TokenValidationProvider>
          </GraphQLProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GitHubErrorBoundary>
  );
};