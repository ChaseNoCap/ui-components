import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: false,
    },
  },
});

// Simple navigation
const SimpleNav = () => (
  <nav className="bg-white shadow p-4">
    <div className="flex gap-4">
      <Link to="/" className="text-blue-600 hover:underline">Home</Link>
      <Link to="/about" className="text-blue-600 hover:underline">About</Link>
      <Link to="/test" className="text-blue-600 hover:underline">Test</Link>
    </div>
  </nav>
);

// Simple pages
const HomePage = () => (
  <div className="p-8">
    <h1 className="text-3xl font-bold mb-4">Home Page</h1>
    <p className="text-gray-600">This is the home page.</p>
  </div>
);

const AboutPage = () => (
  <div className="p-8">
    <h1 className="text-3xl font-bold mb-4">About Page</h1>
    <p className="text-gray-600">This is the about page.</p>
  </div>
);

const TestPage = () => (
  <div className="p-8">
    <h1 className="text-3xl font-bold mb-4">Test Page</h1>
    <div className="space-y-4">
      <div className="p-4 bg-green-50 rounded">
        <p>✅ Routing is working</p>
      </div>
      <div className="p-4 bg-blue-50 rounded">
        <p>✅ Tailwind CSS is working</p>
      </div>
      <div className="p-4 bg-purple-50 rounded">
        <p>✅ React Query is loaded</p>
      </div>
    </div>
  </div>
);

export const AppSimpleFixed: React.FC = () => {
  console.log('AppSimpleFixed rendering');
  
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <SimpleNav />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/test" element={<TestPage />} />
          </Routes>
        </div>
      </Router>
    </QueryClientProvider>
  );
};