import React, { createContext, useContext, useEffect, useState } from 'react';
import { useGitHubToken } from '@/hooks/useGitHubToken';
import type { GitHubTokenStatus, GitHubTokenValidationError } from '@/hooks/useGitHubToken';

interface TokenValidationContextType {
  status: GitHubTokenStatus;
  error: GitHubTokenValidationError | null;
  isValidating: boolean;
  retryValidation: () => void;
  dismissError: () => void;
  isDismissed: boolean;
}

const TokenValidationContext = createContext<TokenValidationContextType | null>(null);

interface Props {
  children: React.ReactNode;
}

/**
 * Context provider for GitHub token validation state
 * Centralizes token validation logic and provides app-wide access
 */
export const TokenValidationProvider: React.FC<Props> = ({ children }) => {
  const { status, error, isValidating, retryValidation } = useGitHubToken();
  const [isDismissed, setIsDismissed] = useState(false);

  // Reset dismissal when error type changes or validation succeeds
  useEffect(() => {
    if (!error || status.isValid) {
      setIsDismissed(false);
    }
  }, [error?.type, status.isValid]);

  const dismissError = () => {
    setIsDismissed(true);
  };

  const contextValue: TokenValidationContextType = {
    status,
    error,
    isValidating,
    retryValidation,
    dismissError,
    isDismissed,
  };

  return (
    <TokenValidationContext.Provider value={contextValue}>
      {children}
    </TokenValidationContext.Provider>
  );
};

/**
 * Hook to access token validation context
 */
export const useTokenValidation = (): TokenValidationContextType => {
  const context = useContext(TokenValidationContext);
  if (!context) {
    throw new Error('useTokenValidation must be used within TokenValidationProvider');
  }
  return context;
};