import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context';
import { ToastProvider } from './components/Toast';
import { TokenValidationProvider } from './contexts';
import { GitHubErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: false,
    },
  },
});

const TestComponent = ({ name }: { name: string }) => (
  <div className="p-4 m-4 bg-green-50 rounded">
    <p>✅ {name} is working!</p>
  </div>
);

export const AppGradual = () => {
  const [level, setLevel] = useState(1);

  const renderLevel = () => {
    // Level 1: Just React
    if (level === 1) {
      return <TestComponent name="Basic React" />;
    }

    // Level 2: React + Router
    if (level === 2) {
      return (
        <Router>
          <Routes>
            <Route path="*" element={<TestComponent name="React + Router" />} />
          </Routes>
        </Router>
      );
    }

    // Level 3: React + Router + Query
    if (level === 3) {
      return (
        <QueryClientProvider client={queryClient}>
          <Router>
            <Routes>
              <Route path="*" element={<TestComponent name="React + Router + Query" />} />
            </Routes>
          </Router>
        </QueryClientProvider>
      );
    }

    // Level 4: Add ThemeProvider
    if (level === 4) {
      return (
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <Router>
              <Routes>
                <Route path="*" element={<TestComponent name="React + Router + Query + Theme" />} />
              </Routes>
            </Router>
          </QueryClientProvider>
        </ThemeProvider>
      );
    }

    // Level 5: Add ToastProvider
    if (level === 5) {
      return (
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <ToastProvider position="top-right">
              <Router>
                <Routes>
                  <Route path="*" element={<TestComponent name="React + Router + Query + Theme + Toast" />} />
                </Routes>
              </Router>
            </ToastProvider>
          </QueryClientProvider>
        </ThemeProvider>
      );
    }

    // Level 6: Add TokenValidationProvider
    if (level === 6) {
      return (
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <TokenValidationProvider>
              <ToastProvider position="top-right">
                <Router>
                  <Routes>
                    <Route path="*" element={<TestComponent name="React + Router + Query + Theme + Toast + Token" />} />
                  </Routes>
                </Router>
              </ToastProvider>
            </TokenValidationProvider>
          </QueryClientProvider>
        </ThemeProvider>
      );
    }

    // Level 7: Add GitHubErrorBoundary
    if (level === 7) {
      return (
        <GitHubErrorBoundary>
          <ThemeProvider>
            <QueryClientProvider client={queryClient}>
              <TokenValidationProvider>
                <ToastProvider position="top-right">
                  <Router>
                    <Routes>
                      <Route path="*" element={<TestComponent name="All Providers Working!" />} />
                    </Routes>
                  </Router>
                </ToastProvider>
              </TokenValidationProvider>
            </QueryClientProvider>
          </ThemeProvider>
        </GitHubErrorBoundary>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold mb-4">Gradual App Test</h1>
      
      <div className="mb-4 space-x-2">
        {[1, 2, 3, 4, 5, 6, 7].map(l => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            className={`px-4 py-2 rounded ${
              level === l 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            Level {l}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <p className="mb-4 text-gray-600">
          Current level: {level} - Testing: {
            level === 1 ? 'Basic React' :
            level === 2 ? 'React + Router' :
            level === 3 ? 'React + Router + Query' :
            level === 4 ? '+ ThemeProvider' :
            level === 5 ? '+ ToastProvider' :
            level === 6 ? '+ TokenValidationProvider' :
            level === 7 ? '+ GitHubErrorBoundary' :
            'Unknown'
          }
        </p>
        
        {renderLevel()}
      </div>
    </div>
  );
};