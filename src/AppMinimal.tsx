import React from 'react';
import './index.css';

export const AppMinimal: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          metaGOTHIC Framework
        </h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-3">System Status</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>React: Working</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Tailwind CSS: Working</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Component Rendering: Working</span>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="font-semibold mb-2">Next Steps:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Check browser console for any errors</li>
            <li>Try the simple app at <code className="bg-gray-200 px-1 rounded">/simple.html</code></li>
            <li>Try the debug app at <code className="bg-gray-200 px-1 rounded">/debug.html</code></li>
          </ol>
        </div>
      </div>
    </div>
  );
};