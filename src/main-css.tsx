import React from 'react';
import ReactDOM from 'react-dom/client';
import { TestWithCSS } from './TestWithCSS';

console.log('main-css.tsx loaded');

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(<TestWithCSS />);
}