import React from 'react';
import { XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorMessageProps {
  title: string;
  message: string;
  severity?: 'error' | 'warning';
  onRetry?: () => void;
  showIcon?: boolean;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title,
  message,
  severity = 'error',
  onRetry,
  showIcon = true,
  className = '',
}) => {
  const severityClasses = {
    error: {
      container: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      icon: 'text-red-600 dark:text-red-400',
      title: 'text-red-800 dark:text-red-200',
      message: 'text-red-700 dark:text-red-300',
      button: 'bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 text-red-800 dark:text-red-200',
    },
    warning: {
      container: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
      icon: 'text-yellow-600 dark:text-yellow-400',
      title: 'text-yellow-800 dark:text-yellow-200',
      message: 'text-yellow-700 dark:text-yellow-300',
      button: 'bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-800 dark:hover:bg-yellow-700 text-yellow-800 dark:text-yellow-200',
    },
  };

  const classes = severityClasses[severity];
  const Icon = severity === 'error' ? XCircle : AlertTriangle;

  return (
    <div
      className={`rounded-lg border p-4 ${classes.container} ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex">
        {showIcon && (
          <div className="flex-shrink-0">
            <Icon className={`h-5 w-5 ${classes.icon}`} aria-hidden="true" />
          </div>
        )}
        <div className={`${showIcon ? 'ml-3' : ''} flex-1`}>
          <h3 className={`text-sm font-medium ${classes.title}`}>{title}</h3>
          <div className={`mt-2 text-sm ${classes.message}`}>
            <p>{message}</p>
          </div>
          {onRetry && (
            <div className="mt-4">
              <button
                type="button"
                onClick={onRetry}
                className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${classes.button} transition-colors`}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};