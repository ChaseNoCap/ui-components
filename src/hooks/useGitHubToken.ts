import { useState, useEffect } from 'react';
import { createLogger } from '@/utils/logger';

export interface GitHubTokenStatus {
  isValid: boolean;
  isPresent: boolean;
  hasRequiredScopes: boolean;
  error?: string;
  tokenInfo?: {
    scopes: string[];
    rateLimit: {
      remaining: number;
      limit: number;
      resetTime: Date;
    };
    user: {
      login: string;
      name: string;
    };
  };
}

export interface GitHubTokenValidationError {
  type: 'missing' | 'invalid' | 'insufficient_scopes' | 'expired' | 'network_error';
  message: string;
  details: string;
  setupUrl?: string;
}

const logger = createLogger('GitHubTokenValidation');

/**
 * Custom hook for GitHub token validation and monitoring
 * Provides real-time token status and validation errors
 */
export function useGitHubToken() {
  const [status, setStatus] = useState<GitHubTokenStatus>({
    isValid: false,
    isPresent: false,
    hasRequiredScopes: false,
  });
  const [error, setError] = useState<GitHubTokenValidationError | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const validateToken = async (token?: string): Promise<void> => {
    setIsValidating(true);
    setError(null);
    
    try {
      const githubToken = token || import.meta.env.VITE_GITHUB_TOKEN;
      
      // Check if token is present
      if (!githubToken) {
        const error: GitHubTokenValidationError = {
          type: 'missing',
          message: 'GitHub token not found',
          details: 'The VITE_GITHUB_TOKEN environment variable is not set. This is required for the metaGOTHIC dashboard to access GitHub API.',
          setupUrl: 'https://github.com/settings/tokens/new?scopes=repo,workflow&description=metaGOTHIC%20Dashboard'
        };
        setError(error);
        setStatus({
          isValid: false,
          isPresent: false,
          hasRequiredScopes: false,
        });
        return;
      }

      // Validate token format
      if (!githubToken.match(/^gh[ps]_[A-Za-z0-9_]{36,}$/)) {
        const error: GitHubTokenValidationError = {
          type: 'invalid',
          message: 'Invalid GitHub token format',
          details: 'The provided token does not match the expected GitHub token format. Make sure you copied the complete token.',
          setupUrl: 'https://github.com/settings/tokens/new?scopes=repo,workflow&description=metaGOTHIC%20Dashboard'
        };
        setError(error);
        setStatus({
          isValid: false,
          isPresent: true,
          hasRequiredScopes: false,
        });
        return;
      }

      // Test token with GitHub API
      logger.info('Validating GitHub token...');
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'metaGOTHIC-Dashboard/1.0.0'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          const error: GitHubTokenValidationError = {
            type: 'invalid',
            message: 'GitHub token authentication failed',
            details: 'The provided token was rejected by GitHub. It may be expired, revoked, or incorrect.',
            setupUrl: 'https://github.com/settings/tokens/new?scopes=repo,workflow&description=metaGOTHIC%20Dashboard'
          };
          setError(error);
          setStatus({
            isValid: false,
            isPresent: true,
            hasRequiredScopes: false,
          });
          return;
        }
        
        if (response.status === 403) {
          const error: GitHubTokenValidationError = {
            type: 'expired',
            message: 'GitHub API rate limit exceeded or token expired',
            details: 'The token may be rate limited or expired. Check your token status on GitHub.',
            setupUrl: 'https://github.com/settings/tokens'
          };
          setError(error);
          setStatus({
            isValid: false,
            isPresent: true,
            hasRequiredScopes: false,
          });
          return;
        }

        throw new Error(`GitHub API responded with status ${response.status}`);
      }

      const userData = await response.json();
      const scopes = response.headers.get('X-OAuth-Scopes')?.split(', ') || [];
      const rateLimit = {
        remaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '0'),
        limit: parseInt(response.headers.get('X-RateLimit-Limit') || '5000'),
        resetTime: new Date(parseInt(response.headers.get('X-RateLimit-Reset') || '0') * 1000)
      };

      // Check required scopes
      const requiredScopes = ['repo', 'workflow'];
      const hasAllScopes = requiredScopes.every(scope => 
        scopes.includes(scope) || scopes.includes('admin:org') // admin:org includes repo
      );

      if (!hasAllScopes) {
        const missingScopes = requiredScopes.filter(scope => !scopes.includes(scope));
        const error: GitHubTokenValidationError = {
          type: 'insufficient_scopes',
          message: 'GitHub token missing required permissions',
          details: `The token is valid but missing these required scopes: ${missingScopes.join(', ')}. Current scopes: ${scopes.join(', ')}.`,
          setupUrl: `https://github.com/settings/tokens/new?scopes=${requiredScopes.join(',')}&description=metaGOTHIC%20Dashboard`
        };
        setError(error);
        setStatus({
          isValid: false,
          isPresent: true,
          hasRequiredScopes: false,
          tokenInfo: {
            scopes,
            rateLimit,
            user: {
              login: userData.login,
              name: userData.name || userData.login
            }
          }
        });
        return;
      }

      // Token is valid
      logger.info('GitHub token validated successfully', {
        user: userData.login,
        scopes: scopes.length,
        rateLimit: rateLimit.remaining
      });
      
      setStatus({
        isValid: true,
        isPresent: true,
        hasRequiredScopes: true,
        tokenInfo: {
          scopes,
          rateLimit,
          user: {
            login: userData.login,
            name: userData.name || userData.login
          }
        }
      });
      
    } catch (err) {
      logger.error('GitHub token validation failed', err as Error);
      const error: GitHubTokenValidationError = {
        type: 'network_error',
        message: 'Failed to validate GitHub token',
        details: `Network error occurred while validating token: ${(err as Error).message}`,
      };
      setError(error);
      setStatus({
        isValid: false,
        isPresent: !!import.meta.env.VITE_GITHUB_TOKEN,
        hasRequiredScopes: false,
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Auto-validate on mount
  useEffect(() => {
    validateToken();
  }, []);

  return {
    status,
    error,
    isValidating,
    validateToken,
    retryValidation: () => validateToken()
  };
}