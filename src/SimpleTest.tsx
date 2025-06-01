import React from 'react';

export const SimpleTest: React.FC = () => {
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
        UI Components Test
      </h1>
      <p>If you can see this, React is working!</p>
      
      <div style={{ marginTop: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
          Status Check:
        </h2>
        <ul>
          <li>✅ React is loaded</li>
          <li>✅ Component is rendering</li>
          <li>✅ Basic styles are working</li>
        </ul>
      </div>
      
      <button 
        onClick={() => alert('Button clicked!')}
        style={{
          marginTop: '16px',
          padding: '8px 16px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Test Button
      </button>
    </div>
  );
};