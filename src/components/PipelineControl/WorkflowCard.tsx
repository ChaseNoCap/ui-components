import React from 'react';
import { Repository } from '@/types';
import { Play, Square, RefreshCw } from 'lucide-react';

interface WorkflowCardProps {
  repository: Repository;
  onTrigger: (workflow: string) => void;
  onCancel: (runId: number) => void;
}

export const WorkflowCard: React.FC<WorkflowCardProps> = ({ repository, onTrigger, onCancel }) => {
  const workflows = [
    { id: 'test.yml', name: 'Run Tests', icon: RefreshCw },
    { id: 'build.yml', name: 'Build', icon: Play },
    { id: 'publish.yml', name: 'Publish', icon: Play },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {repository.name}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {workflows.map(workflow => {
          const Icon = workflow.icon;
          return (
            <button
              key={workflow.id}
              onClick={() => onTrigger(workflow.id)}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
            >
              <Icon className="h-4 w-4" />
              <span>{workflow.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};