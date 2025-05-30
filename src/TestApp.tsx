import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context';
import { ToastProvider, useToastContext } from './components/Toast';
import { ErrorMessage } from './components/ErrorDisplay';

const queryClient = new QueryClient();

const TestContent: React.FC = () => {
  const { showSuccess, showError } = useToastContext();
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Test App - All providers are working!</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-8">Testing individual components...</p>
      
      <div className="space-y-4 max-w-2xl">
        <ErrorMessage
          title="Test Error Message"
          message="This is a test error message component"
          severity="error"
          onRetry={() => showSuccess('Retry clicked', 'You clicked the retry button!')}
        />
        
        <div className="flex gap-4">
          <button
            onClick={() => showSuccess('Success!', 'This is a success toast')}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Show Success Toast
          </button>
          <button
            onClick={() => showError('Error!', 'This is an error toast')}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Show Error Toast
          </button>
        </div>
      </div>
    </div>
  );
};

export const TestApp: React.FC = () => {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <Router>
            <TestContent />
          </Router>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};