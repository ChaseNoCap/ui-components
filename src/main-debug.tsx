import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

console.log('=== main-debug.tsx starting ===');

try {
  const root = document.getElementById('root');
  console.log('Root element:', root);
  
  if (!root) {
    document.body.innerHTML = '<div style="color: red; padding: 20px;">ERROR: Root element not found!</div>';
    throw new Error('Root element not found');
  }
  
  console.log('Creating React root...');
  const reactRoot = ReactDOM.createRoot(root);
  
  console.log('Rendering App component...');
  reactRoot.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
  console.log('App rendered successfully!');
} catch (error) {
  console.error('Error during app initialization:', error);
  document.body.innerHTML = `
    <div style="color: red; padding: 20px; font-family: monospace;">
      <h1>Error Loading App</h1>
      <pre>${error}</pre>
      <p>Check the browser console for more details.</p>
    </div>
  `;
}