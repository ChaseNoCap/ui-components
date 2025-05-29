import React from 'react';
import { GitBranch, Package, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { Repository, HealthMetrics } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

interface RepositoryCardProps {
  repository: Repository;
  metrics?: HealthMetrics;
}

export const RepositoryCard: React.FC<RepositoryCardProps> = ({ repository, metrics }) => {
  const statusColors = {
    healthy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  const buildStatusIcons = {
    passing: <CheckCircle className="h-4 w-4 text-green-500" />,
    failing: <AlertCircle className="h-4 w-4 text-red-500" />,
    unknown: <AlertCircle className="h-4 w-4 text-gray-400" />,
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Package className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {repository.name}
          </h3>
        </div>
        {metrics && (
          <span className={clsx(
            'px-2 py-1 text-xs font-medium rounded-full',
            statusColors[metrics.status]
          )}>
            {metrics.status}
          </span>
        )}
      </div>

      {repository.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {repository.description}
        </p>
      )}

      <div className="space-y-2">
        {repository.version && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Version</span>
            <span className="font-mono">{repository.version}</span>
          </div>
        )}

        {metrics?.metrics.buildStatus && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Build Status</span>
            <div className="flex items-center space-x-1">
              {buildStatusIcons[metrics.metrics.buildStatus]}
              <span>{metrics.metrics.buildStatus}</span>
            </div>
          </div>
        )}

        {metrics?.metrics.testCoverage !== undefined && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Test Coverage</span>
            <span className={clsx(
              'font-mono',
              metrics.metrics.testCoverage >= 80 ? 'text-green-600' :
              metrics.metrics.testCoverage >= 60 ? 'text-yellow-600' :
              'text-red-600'
            )}>
              {metrics.metrics.testCoverage.toFixed(1)}%
            </span>
          </div>
        )}

        {repository.lastCommit && (
          <div className="text-sm">
            <span className="text-gray-500">Last Commit</span>
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
              {repository.lastCommit.message}
            </p>
            <p className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(repository.lastCommit.date), { addSuffix: true })}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <a
          href={repository.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <GitBranch className="h-4 w-4" />
          <span>View Repository</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
};