import React from 'react';
import { Sparkles, AlertCircle, FileText, Clock, Target } from 'lucide-react';

interface ResumptionCardProps {
  session: any;
  resumptionData?: {
    summary: string;
    priority: 'high' | 'medium' | 'low';
    suggestedPrompt?: string;
    openTasks: string[];
    unresolvedErrors: number;
    currentFiles: string[];
  };
  onResume: (sessionId: string, prompt?: string) => void;
  onDismiss: () => void;
}

export const ResumptionCard: React.FC<ResumptionCardProps> = ({
  session,
  resumptionData,
  onResume,
  onDismiss
}) => {
  if (!resumptionData) return null;

  const priorityColors = {
    high: 'border-red-500 bg-red-50 dark:bg-red-900/20',
    medium: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
    low: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
  };

  const priorityIcons = {
    high: <AlertCircle className="h-5 w-5 text-red-600" />,
    medium: <Clock className="h-5 w-5 text-yellow-600" />,
    low: <Sparkles className="h-5 w-5 text-blue-600" />
  };

  return (
    <div className={`border-2 rounded-lg p-4 mb-4 ${priorityColors[resumptionData.priority]}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          {priorityIcons[resumptionData.priority]}
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Resume Session: {session.name}
          </h3>
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          Dismiss
        </button>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
        {resumptionData.summary}
      </p>

      {/* Context Summary */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        {resumptionData.openTasks.length > 0 && (
          <div className="flex items-center space-x-1 text-xs">
            <Target className="h-3 w-3 text-gray-500" />
            <span>{resumptionData.openTasks.length} tasks</span>
          </div>
        )}
        {resumptionData.unresolvedErrors > 0 && (
          <div className="flex items-center space-x-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3" />
            <span>{resumptionData.unresolvedErrors} errors</span>
          </div>
        )}
        {resumptionData.currentFiles.length > 0 && (
          <div className="flex items-center space-x-1 text-xs">
            <FileText className="h-3 w-3 text-gray-500" />
            <span>{resumptionData.currentFiles.length} files</span>
          </div>
        )}
      </div>

      {/* Open Tasks */}
      {resumptionData.openTasks.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Open Tasks:</p>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            {resumptionData.openTasks.slice(0, 3).map((task, i) => (
              <li key={i} className="flex items-start">
                <span className="mr-1">•</span>
                <span className="line-clamp-1">{task}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Prompt */}
      {resumptionData.suggestedPrompt && (
        <div className="bg-white dark:bg-gray-800 rounded p-3 mb-3">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Suggested continuation:
          </p>
          <p className="text-sm text-gray-900 dark:text-white italic">
            "{resumptionData.suggestedPrompt}"
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onResume(session.id, resumptionData.suggestedPrompt)}
          className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center justify-center"
        >
          <Sparkles className="h-4 w-4 mr-1" />
          Resume with AI Context
        </button>
        <button
          onClick={() => onResume(session.id)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm rounded hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Resume Blank
        </button>
      </div>
    </div>
  );
};