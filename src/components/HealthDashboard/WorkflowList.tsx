import React from 'react';
import { HealthMetrics, WorkflowRun } from '@/types';
import { Play, CheckCircle, XCircle, Clock, SkipForward } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

interface WorkflowListProps {
  metrics: HealthMetrics[];
}

export const WorkflowList: React.FC<WorkflowListProps> = ({ metrics }) => {
  // Flatten all workflows from all repositories
  const allWorkflows = metrics.flatMap(m => 
    m.workflows.map(w => ({ ...w, repository: m.repository }))
  );

  // Sort by most recent with safe date parsing
  const sortedWorkflows = allWorkflows.sort((a, b) => {
    const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return dateB - dateA;
  }).slice(0, 10); // Show only 10 most recent

  const statusIcons = {
    queued: <Clock className="h-4 w-4 text-gray-400" />,
    in_progress: <Play className="h-4 w-4 text-blue-500 animate-pulse" />,
    completed: {
      success: <CheckCircle className="h-4 w-4 text-green-500" />,
      failure: <XCircle className="h-4 w-4 text-red-500" />,
      cancelled: <XCircle className="h-4 w-4 text-gray-500" />,
      skipped: <SkipForward className="h-4 w-4 text-gray-400" />,
    },
  };

  const getStatusIcon = (workflow: WorkflowRun) => {
    if (workflow.status === 'completed' && workflow.conclusion) {
      return statusIcons.completed[workflow.conclusion];
    }
    return statusIcons[workflow.status] || null;
  };

  const statusColors = {
    success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    failure: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    queued: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  };

  if (sortedWorkflows.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
        <p className="text-gray-500 dark:text-gray-400">No recent workflow runs</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {sortedWorkflows.map((workflow) => (
          <div key={`${workflow.repository}-${workflow.id}`} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getStatusIcon(workflow)}
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {workflow.name}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      in {workflow.repository}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {workflow.event} • {workflow.headBranch}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className={clsx(
                  'px-2 py-1 text-xs font-medium rounded-full',
                  workflow.conclusion ? statusColors[workflow.conclusion] : statusColors[workflow.status]
                )}>
                  {workflow.conclusion || workflow.status}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {workflow.updatedAt ? 
                    formatDistanceToNow(new Date(workflow.updatedAt), { addSuffix: true }) : 
                    'Unknown time'
                  }
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};