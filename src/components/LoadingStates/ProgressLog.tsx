import React from 'react';
import { CheckCircle, Loader, Terminal } from 'lucide-react';

export interface LogEntry {
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error' | 'progress';
  icon?: React.ReactNode;
}

interface ProgressLogProps {
  title: string;
  entries: LogEntry[];
  isActive: boolean;
}

export const ProgressLog: React.FC<ProgressLogProps> = ({ title, entries, isActive }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  const getIcon = (entry: LogEntry) => {
    if (entry.icon) return entry.icon;
    
    switch (entry.type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <span className="text-red-500">✗</span>;
      case 'progress':
        return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <span className="text-gray-400">›</span>;
    }
  };

  const getTextColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'progress':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="bg-gray-900 dark:bg-gray-950 rounded-lg shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <Terminal className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-200">{title}</h3>
        </div>
        {isActive && (
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-400">Active</span>
          </div>
        )}
      </div>

      {/* Log entries */}
      <div 
        ref={scrollRef}
        className="p-4 space-y-1 font-mono text-sm max-h-96 overflow-y-auto"
      >
        {entries.map((entry, index) => (
          <div key={index} className="flex items-start space-x-2">
            <span className="text-gray-500 text-xs whitespace-nowrap">
              {entry.timestamp.toLocaleTimeString('en-US', { 
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </span>
            <span className="flex-shrink-0">{getIcon(entry)}</span>
            <span className={`flex-1 ${getTextColor(entry.type)}`}>
              {entry.message}
            </span>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-gray-500 text-center py-8">
            Waiting to start...
          </div>
        )}
      </div>
    </div>
  );
};