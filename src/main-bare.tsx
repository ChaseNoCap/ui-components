import React from 'react';
import ReactDOM from 'react-dom/client';
import { BareMinimal } from './BareMinimal';

console.log('=== main-bare.tsx ===');
console.log('React:', React);
console.log('ReactDOM:', ReactDOM);

try {
  const root = document.getElementById('root');
  console.log('Root element:', root);
  
  if (root) {
    const app = React.createElement(BareMinimal);
    console.log('Creating React root...');
    const reactRoot = ReactDOM.createRoot(root);
    console.log('Rendering app...');
    reactRoot.render(app);
    console.log('✅ App rendered');
  } else {
    throw new Error('No root element');
  }
} catch (error) {
  console.error('❌ Error:', error);
  document.body.innerHTML = `
    <div style="color: red; padding: 20px;">
      <h1>Error in main-bare.tsx</h1>
      <pre>${error}</pre>
    </div>
  `;
}