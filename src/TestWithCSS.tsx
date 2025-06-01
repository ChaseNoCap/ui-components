import React from 'react';
import './index.css';  // This imports Tailwind CSS

export const TestWithCSS = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Test With Tailwind CSS
        </h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-2xl font-semibold mb-2">CSS Test</h2>
          <p className="text-gray-600">
            If this has proper styling (gray background, white card, shadows), then Tailwind CSS is working.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded">
            <p className="text-blue-900">Blue Box</p>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <p className="text-green-900">Green Box</p>
          </div>
        </div>

        <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Tailwind Button
        </button>
      </div>
    </div>
  );
};