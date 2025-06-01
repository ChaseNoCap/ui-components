import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Test components
const TestStatus = ({ name, success }: { name: string; success: boolean }) => (
  <div style={{ 
    padding: '10px', 
    margin: '5px 0', 
    backgroundColor: success ? '#d1fae5' : '#fee2e2',
    borderRadius: '4px' 
  }}>
    {success ? '✅' : '❌'} {name}
  </div>
);

const BasicComponent = () => <div>Basic Component Works!</div>;

export const StepByStepTest = () => {
  const [testLevel, setTestLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Step by Step Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => setTestLevel(0)}
          style={{ marginRight: '10px', padding: '5px 10px' }}
        >
          Reset
        </button>
        <button 
          onClick={() => setTestLevel(1)}
          style={{ marginRight: '10px', padding: '5px 10px' }}
        >
          Test Router
        </button>
        <button 
          onClick={() => setTestLevel(2)}
          style={{ marginRight: '10px', padding: '5px 10px' }}
        >
          Test Query Client
        </button>
        <button 
          onClick={() => setTestLevel(3)}
          style={{ marginRight: '10px', padding: '5px 10px' }}
        >
          Test Both
        </button>
      </div>

      <TestStatus name="Basic React" success={true} />
      
      {error && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#fee2e2', 
          color: '#dc2626',
          marginTop: '10px',
          borderRadius: '4px'
        }}>
          Error: {error}
        </div>
      )}

      <div style={{ 
        marginTop: '20px', 
        padding: '20px', 
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        minHeight: '200px'
      }}>
        {testLevel === 0 && (
          <div>
            <h2>No providers active</h2>
            <BasicComponent />
          </div>
        )}

        {testLevel === 1 && (
          <div>
            <h2>Testing React Router only</h2>
            <TestStatus name="React Router" success={!error} />
            <Router>
              <nav>
                <Link to="/">Home</Link> | <Link to="/about">About</Link>
              </nav>
              <Routes>
                <Route path="/" element={<div>Home Page</div>} />
                <Route path="/about" element={<div>About Page</div>} />
              </Routes>
            </Router>
          </div>
        )}

        {testLevel === 2 && (
          <div>
            <h2>Testing React Query only</h2>
            <TestStatus name="React Query" success={!error} />
            <QueryClientProvider client={queryClient}>
              <BasicComponent />
            </QueryClientProvider>
          </div>
        )}

        {testLevel === 3 && (
          <div>
            <h2>Testing Both Router and Query</h2>
            <TestStatus name="React Router + Query" success={!error} />
            <QueryClientProvider client={queryClient}>
              <Router>
                <nav>
                  <Link to="/">Home</Link> | <Link to="/about">About</Link>
                </nav>
                <Routes>
                  <Route path="/" element={<div>Home with Query</div>} />
                  <Route path="/about" element={<div>About with Query</div>} />
                </Routes>
              </Router>
            </QueryClientProvider>
          </div>
        )}
      </div>
    </div>
  );
};