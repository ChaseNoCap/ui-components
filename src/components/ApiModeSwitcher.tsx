import React from 'react';
import { Globe, Server } from 'lucide-react';
import { api, ApiMode } from '../services/api-adapter';

export const ApiModeSwitcher: React.FC = () => {
  const currentMode = api.mode.get();

  const handleModeChange = (mode: ApiMode) => {
    if (mode !== currentMode) {
      if (confirm(`Switch to ${mode.toUpperCase()} API mode? This will reload the page.`)) {
        api.mode.set(mode);
      }
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">API Mode:</span>
      <div className="flex gap-1">
        <button
          onClick={() => handleModeChange('graphql')}
          className={`px-3 py-1 rounded flex items-center gap-1 text-sm transition-colors ${
            currentMode === 'graphql'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          <Globe className="h-3 w-3" />
          GraphQL
        </button>
        <button
          onClick={() => handleModeChange('rest')}
          className={`px-3 py-1 rounded flex items-center gap-1 text-sm transition-colors ${
            currentMode === 'rest'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          <Server className="h-3 w-3" />
          REST
        </button>
      </div>
    </div>
  );
};