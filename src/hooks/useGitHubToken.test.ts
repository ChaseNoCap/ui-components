import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGitHubToken } from './useGitHubToken';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variable
const mockEnv = {
  VITE_GITHUB_TOKEN: ''
};

vi.mock('import.meta', () => ({
  env: mockEnv
}));

describe('useGitHubToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.VITE_GITHUB_TOKEN = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should detect missing token', async () => {
    const { result } = renderHook(() => useGitHubToken());

    await waitFor(() => {
      expect(result.current.error?.type).toBe('missing');
      expect(result.current.status.isPresent).toBe(false);
      expect(result.current.status.isValid).toBe(false);
    });
  });

  it('should detect invalid token format', async () => {
    mockEnv.VITE_GITHUB_TOKEN = 'invalid_token';
    
    const { result } = renderHook(() => useGitHubToken());

    await waitFor(() => {
      expect(result.current.error?.type).toBe('invalid');
      expect(result.current.status.isPresent).toBe(true);
      expect(result.current.status.isValid).toBe(false);
    });
  });

  it('should handle valid token with successful API response', async () => {
    mockEnv.VITE_GITHUB_TOKEN = 'ghp_1234567890123456789012345678901234567890';
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: (header: string) => {
          switch (header) {
            case 'X-OAuth-Scopes':
              return 'repo, workflow';
            case 'X-RateLimit-Remaining':
              return '4999';
            case 'X-RateLimit-Limit':
              return '5000';
            case 'X-RateLimit-Reset':
              return String(Math.floor(Date.now() / 1000) + 3600);
            default:
              return null;
          }
        }
      },
      json: async () => ({
        login: 'testuser',
        name: 'Test User'
      })
    });

    const { result } = renderHook(() => useGitHubToken());

    await waitFor(() => {
      expect(result.current.status.isValid).toBe(true);
      expect(result.current.status.isPresent).toBe(true);
      expect(result.current.status.hasRequiredScopes).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });

  it('should handle authentication failure', async () => {
    mockEnv.VITE_GITHUB_TOKEN = 'ghp_1234567890123456789012345678901234567890';
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401
    });

    const { result } = renderHook(() => useGitHubToken());

    await waitFor(() => {
      expect(result.current.error?.type).toBe('invalid');
      expect(result.current.status.isValid).toBe(false);
    });
  });

  it('should handle insufficient scopes', async () => {
    mockEnv.VITE_GITHUB_TOKEN = 'ghp_1234567890123456789012345678901234567890';
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: (header: string) => {
          switch (header) {
            case 'X-OAuth-Scopes':
              return 'public_repo'; // Missing workflow scope
            case 'X-RateLimit-Remaining':
              return '4999';
            case 'X-RateLimit-Limit':
              return '5000';
            case 'X-RateLimit-Reset':
              return String(Math.floor(Date.now() / 1000) + 3600);
            default:
              return null;
          }
        }
      },
      json: async () => ({
        login: 'testuser',
        name: 'Test User'
      })
    });

    const { result } = renderHook(() => useGitHubToken());

    await waitFor(() => {
      expect(result.current.error?.type).toBe('insufficient_scopes');
      expect(result.current.status.isPresent).toBe(true);
      expect(result.current.status.hasRequiredScopes).toBe(false);
    });
  });

  it('should handle network errors', async () => {
    mockEnv.VITE_GITHUB_TOKEN = 'ghp_1234567890123456789012345678901234567890';
    
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useGitHubToken());

    await waitFor(() => {
      expect(result.current.error?.type).toBe('network_error');
      expect(result.current.status.isValid).toBe(false);
    });
  });
});