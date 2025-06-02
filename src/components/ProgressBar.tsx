import React from 'react';
import { Clock } from 'lucide-react';

interface ProgressBarProps {
  percentage: number;
  label?: string;
  stage?: string;
  estimatedTimeRemaining?: number;
  showPercentage?: boolean;
  className?: string;
}

export function ProgressBar({
  percentage,
  label,
  stage,
  estimatedTimeRemaining,
  showPercentage = true,
  className = ''
}: ProgressBarProps) {
  // Ensure percentage is within bounds
  const normalizedPercentage = Math.max(0, Math.min(100, percentage));

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
          {stage && <span className="text-xs text-gray-500">({stage})</span>}
        </div>
        <div className="flex items-center gap-3">
          {estimatedTimeRemaining !== undefined && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span>{formatTime(estimatedTimeRemaining)}</span>
            </div>
          )}
          {showPercentage && (
            <span className="text-sm font-medium text-gray-700">{normalizedPercentage}%</span>
          )}
        </div>
      </div>
      
      <div className="relative w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${normalizedPercentage}%` }}
        >
          {/* Animated stripe pattern */}
          <div className="absolute inset-0 bg-stripes opacity-20 animate-slide" />
        </div>
      </div>
    </div>
  );
}

interface BatchProgressProps {
  totalOperations: number;
  completedOperations: number;
  failedOperations: number;
  overallPercentage: number;
  estimatedTimeRemaining?: number;
  className?: string;
}

export function BatchProgress({
  totalOperations,
  completedOperations,
  failedOperations,
  overallPercentage,
  estimatedTimeRemaining,
  className = ''
}: BatchProgressProps) {
  const inProgress = totalOperations - completedOperations - failedOperations;

  return (
    <div className={`${className}`}>
      <ProgressBar
        percentage={overallPercentage}
        label="Overall Progress"
        estimatedTimeRemaining={estimatedTimeRemaining}
        className="mb-4"
      />
      
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-400 rounded-full" />
          <span className="text-gray-600">Queued: {inProgress}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full" />
          <span className="text-gray-600">Completed: {completedOperations}</span>
        </div>
        {failedOperations > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <span className="text-gray-600">Failed: {failedOperations}</span>
          </div>
        )}
      </div>
    </div>
  );
}