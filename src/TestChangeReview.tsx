import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context';
import { ToastProvider } from './components/Toast';
import { ChangeReviewPage } from './pages/ChangeReview';

const queryClient = new QueryClient();

export const TestChangeReview: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider position="top-right">
          <Router>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
              <div className="p-4">
                <h1 className="text-2xl font-bold mb-4">Test Change Review</h1>
                <ChangeReviewPage />
              </div>
            </div>
          </Router>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};