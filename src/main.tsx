import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// Add debugging
console.log('main.tsx loaded');

// Check if we should use minimal app for debugging
const useMinimal = window.location.search.includes('minimal=true');
console.log('Using minimal app:', useMinimal);

const root = document.getElementById('root');
if (!root) {
  console.error('Root element not found!');
  document.body.innerHTML = '<h1 style="color: red;">Error: Root element not found</h1>';
} else {
  // Dynamic import to catch errors
  const loadApp = async () => {
    try {
      if (useMinimal) {
        console.log('Loading AppMinimal...');
        const { AppMinimal } = await import('./AppMinimal');
        console.log('AppMinimal loaded:', AppMinimal);
        
        ReactDOM.createRoot(root).render(
          <React.StrictMode>
            <AppMinimal />
          </React.StrictMode>
        );
      } else {
        console.log('Loading App...');
        const { App } = await import('./App');
        console.log('App loaded:', App);
        
        ReactDOM.createRoot(root).render(
          <React.StrictMode>
            <App />
          </React.StrictMode>
        );
      }
      console.log('App rendered successfully');
    } catch (error) {
      console.error('Error loading/rendering app:', error);
      root.innerHTML = `<div style="color: red; padding: 20px; font-family: monospace;">
        <h1>Error loading app</h1>
        <pre>${error}\n\nStack:\n${error.stack}</pre>
        <p>Check browser console for more details.</p>
      </div>`;
    }
  };
  
  loadApp();
}