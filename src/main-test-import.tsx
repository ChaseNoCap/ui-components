import React from 'react';
import ReactDOM from 'react-dom/client';

console.log('=== Testing imports ===');

// Test each import individually
async function testImports() {
  try {
    console.log('1. Testing React import...');
    console.log('React:', React);
    console.log('✅ React imported successfully');
  } catch (e) {
    console.error('❌ React import failed:', e);
  }

  try {
    console.log('\n2. Testing App import...');
    const { App } = await import('./App');
    console.log('App:', App);
    console.log('✅ App imported successfully');
  } catch (e) {
    console.error('❌ App import failed:', e);
  }

  try {
    console.log('\n3. Testing AppMinimal import...');
    const { AppMinimal } = await import('./AppMinimal');
    console.log('AppMinimal:', AppMinimal);
    console.log('✅ AppMinimal imported successfully');
    
    // Try to render it
    const root = document.getElementById('root');
    if (root) {
      console.log('\n4. Attempting to render AppMinimal...');
      ReactDOM.createRoot(root).render(
        React.createElement(AppMinimal)
      );
      console.log('✅ AppMinimal rendered successfully');
    }
  } catch (e) {
    console.error('❌ AppMinimal import/render failed:', e);
  }

  try {
    console.log('\n5. Testing CSS import...');
    await import('./index.css');
    console.log('✅ CSS imported successfully');
  } catch (e) {
    console.error('❌ CSS import failed:', e);
  }
}

// Run the tests
testImports().catch(console.error);