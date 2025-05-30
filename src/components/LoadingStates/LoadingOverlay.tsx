import React from 'react';
import { Spinner } from './Spinner';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  fullScreen?: boolean;
  blur?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message = 'Loading data...',
  fullScreen = false,
  blur = true,
}) => {
  if (!isLoading) return null;

  const overlayClasses = fullScreen
    ? 'fixed inset-0 z-50'
    : 'absolute inset-0 z-10';

  return (
    <div className={`${overlayClasses} flex items-center justify-center`}>
      {blur && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm" />
      )}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col items-center">
        <Spinner size="lg" />
        <p className="mt-4 text-gray-600 dark:text-gray-300">{message}</p>
      </div>
    </div>
  );
};