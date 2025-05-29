import React, { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import { useTheme } from '../../context';

interface TerminalLine {
  id: string;
  timestamp: Date;
  type: 'command' | 'output' | 'error' | 'info';
  content: string;
}

interface TerminalOutputProps {
  lines: TerminalLine[];
  title?: string;
  className?: string;
}

export const TerminalOutput: React.FC<TerminalOutputProps> = ({
  lines,
  title = 'Terminal Output',
  className = ''
}) => {
  const { theme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new lines are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const getLineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'command':
        return 'text-blue-400';
      case 'error':
        return 'text-red-400';
      case 'info':
        return 'text-gray-400';
      default:
        return 'text-gray-200';
    }
  };

  const formatLine = (line: TerminalLine) => {
    const time = line.timestamp.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    if (line.type === 'command') {
      return (
        <>
          <span className="text-gray-500">[{time}]</span>
          <span className="text-green-400 ml-2">$</span>
          <span className={`ml-2 ${getLineColor(line.type)}`}>{line.content}</span>
        </>
      );
    }

    return (
      <>
        <span className="text-gray-500">[{time}]</span>
        <span className={`ml-2 ${getLineColor(line.type)}`}>{line.content}</span>
      </>
    );
  };

  return (
    <div className={`bg-gray-900 rounded-lg border border-gray-700 ${className}`}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <Terminal className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">{title}</span>
        </div>
        <div className="flex space-x-1">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="p-4 font-mono text-sm overflow-y-auto max-h-96"
        style={{ backgroundColor: theme === 'dark' ? '#0a0a0a' : '#1a1a1a' }}
      >
        {lines.length === 0 ? (
          <div className="text-gray-500 italic">No output yet...</div>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="leading-relaxed">
              {formatLine(line)}
            </div>
          ))
        )}
      </div>
    </div>
  );
};