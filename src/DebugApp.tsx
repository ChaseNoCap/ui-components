import React from 'react';

console.log('DebugApp: Starting imports...');

try {
  console.log('Importing Router...');
  const { BrowserRouter: Router, Routes, Route, NavLink } = await import('react-router-dom');
  console.log('✓ Router imported');
  
  console.log('Importing QueryClient...');
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  console.log('✓ QueryClient imported');
  
  console.log('Importing components...');
  const { GitHubErrorBoundary } = await import('./components/ErrorBoundary');
  console.log('✓ GitHubErrorBoundary imported');
  
  const { ThemeProvider } = await import('./context');
  console.log('✓ ThemeProvider imported');
  
  const { ToastProvider } = await import('./components/Toast');
  console.log('✓ ToastProvider imported');
  
  const { TokenValidationProvider } = await import('./contexts');
  console.log('✓ TokenValidationProvider imported');
  
} catch (error) {
  console.error('Import error:', error);
}

export const DebugApp: React.FC = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Debug App</h1>
      <p>Check the console for import errors.</p>
    </div>
  );
};