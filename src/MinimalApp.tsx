import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false, // Disable retries for debugging
      refetchOnWindowFocus: false,
    },
  },
});

const HomePage = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Home Page</h1>
    <p>If you see this, the basic routing is working.</p>
  </div>
);

const PipelinesPage = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Pipelines Page</h1>
  </div>
);

const ToolsPage = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Tools Page</h1>
  </div>
);

export const MinimalApp: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <nav className="bg-white shadow p-4">
            <div className="flex gap-4">
              <a href="/" className="text-blue-500 hover:text-blue-700">Home</a>
              <a href="/pipelines" className="text-blue-500 hover:text-blue-700">Pipelines</a>
              <a href="/tools" className="text-blue-500 hover:text-blue-700">Tools</a>
            </div>
          </nav>
          
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/pipelines" element={<PipelinesPage />} />
            <Route path="/tools" element={<ToolsPage />} />
          </Routes>
        </div>
      </Router>
    </QueryClientProvider>
  );
};