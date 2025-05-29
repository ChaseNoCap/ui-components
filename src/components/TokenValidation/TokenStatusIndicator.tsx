import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Loader2, Github, User, Clock } from 'lucide-react';
import type { GitHubTokenStatus } from '@/hooks/useGitHubToken';

interface Props {
  status: GitHubTokenStatus;
  isValidating: boolean;
  onRefresh?: () => void;
  showDetails?: boolean;
}

/**
 * Token status indicator for the dashboard header
 * Shows visual status and optional detailed information
 */
export const TokenStatusIndicator: React.FC<Props> = ({ 
  status, 
  isValidating, 
  onRefresh,
  showDetails = false 
}) => {
  const getStatusIcon = () => {
    if (isValidating) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    
    if (status.isValid) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    if (!status.isPresent) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    
    if (!status.hasRequiredScopes) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusText = () => {
    if (isValidating) {
      return 'Validating...';
    }
    
    if (status.isValid) {
      return 'Token Valid';
    }
    
    if (!status.isPresent) {
      return 'Token Missing';
    }
    
    if (!status.hasRequiredScopes) {
      return 'Insufficient Permissions';
    }
    
    return 'Token Invalid';
  };

  const getStatusColor = () => {
    if (isValidating) {
      return 'text-blue-600 dark:text-blue-400';
    }
    
    if (status.isValid) {
      return 'text-green-600 dark:text-green-400';
    }
    
    if (!status.isPresent || !status.hasRequiredScopes) {
      return 'text-red-600 dark:text-red-400';
    }
    
    return 'text-yellow-600 dark:text-yellow-400';
  };

  const formatResetTime = (resetTime: Date) => {
    const now = new Date();
    const diff = resetTime.getTime() - now.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-center space-x-1">
        {getStatusIcon()}
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>
      
      {showDetails && status.tokenInfo && (
        <div className="hidden lg:flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-1">
            <User className="h-3 w-3" />
            <span>{status.tokenInfo.user.login}</span>
          </div>
          
          <div className="flex items-center space-x-1">
            <Github className="h-3 w-3" />
            <span>{status.tokenInfo.rateLimit.remaining}/{status.tokenInfo.rateLimit.limit}</span>
          </div>
          
          {status.tokenInfo.rateLimit.remaining < 1000 && (
            <div className="flex items-center space-x-1 text-yellow-500">
              <Clock className="h-3 w-3" />
              <span>Resets in {formatResetTime(status.tokenInfo.rateLimit.resetTime)}</span>
            </div>
          )}
        </div>
      )}
      
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isValidating}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Refresh token status"
        >
          Refresh
        </button>
      )}
    </div>
  );
};