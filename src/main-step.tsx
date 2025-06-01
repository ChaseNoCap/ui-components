import React from 'react';
import ReactDOM from 'react-dom/client';
import { StepByStepTest } from './StepByStepTest';

console.log('main-step.tsx loaded');

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <StepByStepTest />
    </React.StrictMode>
  );
}