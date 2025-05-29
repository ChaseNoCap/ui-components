import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubErrorBoundary, GitHubError } from './GitHubErrorBoundary';

// Mock component that throws errors
const ThrowError: React.FC<{ error: Error }> = ({ error }) => {
  throw error;
};

const NormalComponent: React.FC = () => <div>Working component</div>;

describe('GitHubErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock console.error to prevent error logs in tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children when there is no error', () => {
    render(
      <GitHubErrorBoundary>
        <NormalComponent />
      </GitHubErrorBoundary>
    );

    expect(screen.getByText('Working component')).toBeInTheDocument();
  });

  it('catches and displays authentication errors', () => {
    const authError = new Error('GitHub token required for real API access');

    render(
      <GitHubErrorBoundary>
        <ThrowError error={authError} />
      </GitHubErrorBoundary>
    );

    expect(screen.getByText('GitHub authentication failed')).toBeInTheDocument();
    expect(screen.getByText(/Your GitHub token is missing, invalid, or has insufficient permissions/)).toBeInTheDocument();
    expect(screen.getByText('GitHub Token Setup Required')).toBeInTheDocument();
    expect(screen.getByText('Create GitHub Token')).toBeInTheDocument();
  });

  it('catches and displays rate limit errors', () => {
    const rateLimitError = new Error('API rate limit exceeded');

    render(
      <GitHubErrorBoundary>
        <ThrowError error={rateLimitError} />
      </GitHubErrorBoundary>
    );

    expect(screen.getByText('GitHub API rate limit exceeded')).toBeInTheDocument();
    expect(screen.getByText(/API requests are temporarily limited/)).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('catches and displays network errors', () => {
    const networkError = new Error('Network connection failed');

    render(
      <GitHubErrorBoundary>
        <ThrowError error={networkError} />
      </GitHubErrorBoundary>
    );

    expect(screen.getByText('Network connection failed')).toBeInTheDocument();
    expect(screen.getByText(/Unable to connect to GitHub API/)).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('catches and displays API errors', () => {
    const apiError = new Error('GitHub server error 500');

    render(
      <GitHubErrorBoundary>
        <ThrowError error={apiError} />
      </GitHubErrorBoundary>
    );

    expect(screen.getByText('GitHub server error')).toBeInTheDocument();
    expect(screen.getByText(/GitHub is experiencing server issues/)).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('handles unknown errors', () => {
    const unknownError = new Error('Something completely unexpected');

    render(
      <GitHubErrorBoundary>
        <ThrowError error={unknownError} />
      </GitHubErrorBoundary>
    );

    expect(screen.getByText('Something completely unexpected')).toBeInTheDocument();
    expect(screen.getByText(/An unknown error occurred/)).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('calls onError callback when error occurs', () => {
    const onError = vi.fn();
    const error = new Error('Test error');

    render(
      <GitHubErrorBoundary onError={onError}>
        <ThrowError error={error} />
      </GitHubErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Test error',
        type: 'unknown',
        retryable: true
      })
    );
  });

  it('uses custom fallback component when provided', () => {
    const customFallback = (error: GitHubError, retry: () => void) => (
      <div>
        <span>Custom error: {error.message}</span>
        <button onClick={retry}>Custom retry</button>
      </div>
    );

    const error = new Error('Test error');

    render(
      <GitHubErrorBoundary fallback={customFallback}>
        <ThrowError error={error} />
      </GitHubErrorBoundary>
    );

    expect(screen.getByText('Custom error: Test error')).toBeInTheDocument();
    expect(screen.getByText('Custom retry')).toBeInTheDocument();
  });

  it('handles retry functionality with exponential backoff', async () => {
    vi.useFakeTimers();

    const rateLimitError = new Error('rate limit exceeded');

    const { rerender } = render(
      <GitHubErrorBoundary>
        <ThrowError error={rateLimitError} />
      </GitHubErrorBoundary>
    );

    const retryButton = screen.getByText('Retry');
    
    fireEvent.click(retryButton);
    
    // Button should be disabled during retry
    expect(retryButton).toBeDisabled();
    expect(screen.getByText('Retrying...')).toBeInTheDocument();

    // Fast-forward time to complete the retry
    vi.advanceTimersByTime(2000);

    // Rerender with working component after retry
    rerender(
      <GitHubErrorBoundary>
        <NormalComponent />
      </GitHubErrorBoundary>
    );

    expect(screen.getByText('Working component')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('shows retry count after multiple attempts', () => {
    vi.useFakeTimers();

    const error = new Error('Test error');

    render(
      <GitHubErrorBoundary>
        <ThrowError error={error} />
      </GitHubErrorBoundary>
    );

    const retryButton = screen.getByText('Retry');
    
    fireEvent.click(retryButton);
    
    // Check that retry count increased
    expect(screen.getByText('Retry attempt: 1')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('provides reload page functionality', () => {
    // Mock window.location.reload
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true
    });

    const error = new Error('Test error');

    render(
      <GitHubErrorBoundary>
        <ThrowError error={error} />
      </GitHubErrorBoundary>
    );

    const reloadButton = screen.getByText('Reload Page');
    fireEvent.click(reloadButton);

    expect(reloadMock).toHaveBeenCalled();
  });

  it('does not show retry button for non-retryable errors', () => {
    const authError = new Error('unauthorized');

    render(
      <GitHubErrorBoundary>
        <ThrowError error={authError} />
      </GitHubErrorBoundary>
    );

    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });
});