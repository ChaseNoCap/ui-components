import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppSimple } from './AppSimple';

console.log('main-simple.tsx loaded');

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AppSimple />
    </React.StrictMode>,
  );
  console.log('AppSimple rendered');
} else {
  console.error('Root element not found');
}