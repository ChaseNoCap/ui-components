import React from 'react';
import ReactDOM from 'react-dom/client';
import { SimpleTest } from './SimpleTest';

console.log('Test main.tsx loaded');

const root = document.getElementById('root');
console.log('Root element:', root);

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <SimpleTest />
    </React.StrictMode>,
  );
  console.log('React app rendered');
} else {
  console.error('Root element not found!');
}