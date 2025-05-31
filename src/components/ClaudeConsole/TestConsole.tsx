import React from 'react';

export const TestConsole: React.FC = () => {
  console.log('TestConsole rendering');
  
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', height: '100vh' }}>
      <h1>Claude Console Test</h1>
      <p>If you can see this, the component is rendering correctly.</p>
    </div>
  );
};