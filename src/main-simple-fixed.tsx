import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppSimpleFixed } from './AppSimpleFixed';

console.log('main-simple-fixed.tsx loaded');

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AppSimpleFixed />
    </React.StrictMode>
  );
}