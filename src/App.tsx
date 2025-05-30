import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { HealthDashboard } from './components/HealthDashboard';
import { PipelineControl } from './components/PipelineControl';
import { Tools } from './pages/Tools';
import { ChangeReview } from './pages/ChangeReview';
import { GitHubErrorBoundary } from './components/ErrorBoundary';
import { GitHubTokenBanner } from './components/TokenValidation';
import { Navigation } from './components/Navigation';
import { TokenValidationProvider, useTokenValidation } from './contexts';
import { ThemeProvider } from './context';
import { ToastProvider } from './components/Toast';

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
        <Route path="/tools/change-review" element={<ChangeReview />} />
        <Route path="/tools/repository-status" element={<div>Repository Status - Coming Soon</div>} />
        <Route path="/tools/manual-commit" element={<div>Manual Commit - Coming Soon</div>} />
      </Routes>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <GitHubErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TokenValidationProvider>
            <ToastProvider position="top-right">
              <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
                <DashboardContent />
                <ReactQueryDevtools initialIsOpen={false} />
              </Router>
            </ToastProvider>
          </TokenValidationProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GitHubErrorBoundary>
  );
};