import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Activity, GitBranch, Wrench, Moon, Sun } from 'lucide-react';
import { HealthDashboard } from './components/HealthDashboard';
import { PipelineControl } from './components/PipelineControl';
import { Tools } from './pages/Tools';
import { GitHubErrorBoundary } from './components/ErrorBoundary';
import { GitHubTokenBanner, TokenStatusIndicator } from './components/TokenValidation';
import { TokenValidationProvider, useTokenValidation } from './contexts';
import { ThemeProvider, useTheme } from './context';
import clsx from 'clsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
    },
  },
});

const Navigation: React.FC = () => {
  const { status, isValidating, retryValidation } = useTokenValidation();
  const { theme, toggleTheme } = useTheme();
  
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
      isActive
        ? 'bg-gray-900 text-white dark:bg-gray-700'
        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
    );

  return (
    <nav className="bg-white dark:bg-gray-800 shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                metaGOTHIC
              </h1>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <NavLink to="/" className={navLinkClass}>
                <Activity className="h-4 w-4" />
                <span>Health Monitor</span>
              </NavLink>
              <NavLink to="/pipelines" className={navLinkClass}>
                <GitBranch className="h-4 w-4" />
                <span>Pipeline Control</span>
              </NavLink>
              <NavLink to="/tools" className={navLinkClass}>
                <Wrench className="h-4 w-4" />
                <span>Tools</span>
              </NavLink>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
            <TokenStatusIndicator 
              status={status}
              isValidating={isValidating}
              onRefresh={retryValidation}
              showDetails={true}
            />
          </div>
        </div>
      </div>
    </nav>
  );
};

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
            <Router>
              <DashboardContent />
              <ReactQueryDevtools initialIsOpen={false} />
            </Router>
          </TokenValidationProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GitHubErrorBoundary>
  );
};