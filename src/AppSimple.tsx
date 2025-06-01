import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChangeReviewPage } from './pages/ChangeReview';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: false, // Disable retries for testing
    },
  },
});

// Simple navigation
const SimpleNav = () => (
  <nav className="bg-white shadow p-4">
    <div className="flex gap-4">
      <Link to="/" className="text-blue-600 hover:underline">Home</Link>
      <Link to="/change-review" className="text-blue-600 hover:underline">Change Review</Link>
    </div>
  </nav>
);

// Simple home page
const HomePage = () => (
  <div className="p-8">
    <h1 className="text-3xl font-bold mb-4">metaGOTHIC Dashboard</h1>
    <p className="text-gray-600">Welcome to the metaGOTHIC framework dashboard.</p>
    <div className="mt-8 space-y-4">
      <div className="p-4 bg-blue-50 rounded">
        <h2 className="font-semibold">✅ React is working</h2>
      </div>
      <div className="p-4 bg-green-50 rounded">
        <h2 className="font-semibold">✅ Tailwind CSS is working</h2>
      </div>
      <div className="p-4 bg-purple-50 rounded">
        <h2 className="font-semibold">✅ Routing is working</h2>
      </div>
    </div>
  </div>
);

export const AppSimple: React.FC = () => {
  console.log('AppSimple rendering');
  
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <SimpleNav />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/change-review" element={<ChangeReviewPage />} />
          </Routes>
        </div>
      </Router>
    </QueryClientProvider>
  );
};