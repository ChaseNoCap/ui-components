import React from 'react';

export function BareMinimal() {
  console.log('BareMinimal component rendering');
  
  return React.createElement(
    'div',
    { 
      style: { 
        padding: '40px',
        backgroundColor: '#e5e7eb',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif'
      } 
    },
    React.createElement('h1', { style: { fontSize: '32px', marginBottom: '20px' } }, 'Bare Minimal Test'),
    React.createElement('p', null, 'If you see this, React is working without any imports or dependencies.'),
    React.createElement(
      'div',
      { style: { marginTop: '20px', padding: '20px', backgroundColor: 'white', borderRadius: '8px' } },
      React.createElement('pre', null, 'React version: ' + React.version)
    )
  );
}