import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppGradual } from './AppGradual';

console.log('main-gradual.tsx loaded');

try {
  const root = document.getElementById('root');
  if (root) {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <AppGradual />
      </React.StrictMode>
    );
  }
} catch (error) {
  console.error('Error in main-gradual:', error);
}