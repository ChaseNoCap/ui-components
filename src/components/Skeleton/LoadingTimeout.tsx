import React, { useState, useEffect, ReactNode } from 'react';

interface LoadingTimeoutProps {
  isLoading: boolean;
  timeout?: number; // in milliseconds, default 30 seconds
  children: ReactNode;
  fallback?: ReactNode;
  onTimeout?: () => void;
}

export const LoadingTimeout: React.FC<LoadingTimeoutProps> = ({ 
  isLoading, 
  timeout = 30000, // 30 seconds default
  children, 
  fallback,
  onTimeout 
}) => {
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setHasTimedOut(false);
      return;
    }

    const timer = setTimeout(() => {
      setHasTimedOut(true);
      onTimeout?.();
    }, timeout);

    return () => clearTimeout(timer);
  }, [isLoading, timeout, onTimeout]);

  if (hasTimedOut) {
    return (
      fallback || (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="text-red-500 mb-2">
            <svg className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            Loading Timeout
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Data is taking longer than expected to load. Please refresh the page or try again later.
          </p>
        </div>
      )
    );
  }

  return <>{children}</>;
};