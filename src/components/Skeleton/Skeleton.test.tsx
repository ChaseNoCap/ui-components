import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RepositoryCardSkeleton } from './RepositoryCardSkeleton';
import { MetricsOverviewSkeleton } from './MetricsOverviewSkeleton';
import { WorkflowListSkeleton } from './WorkflowListSkeleton';
import { LoadingTimeout } from './LoadingTimeout';

describe('Skeleton Components', () => {
  describe('RepositoryCardSkeleton', () => {
    it('renders without crashing', () => {
      const { container } = render(<RepositoryCardSkeleton />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('has proper styling classes', () => {
      const { container } = render(<RepositoryCardSkeleton />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('bg-white', 'dark:bg-gray-800', 'rounded-lg', 'shadow-md');
    });
  });

  describe('MetricsOverviewSkeleton', () => {
    it('renders 6 skeleton cards', () => {
      const { container } = render(<MetricsOverviewSkeleton />);
      const cards = container.querySelectorAll('.bg-white');
      expect(cards).toHaveLength(6);
    });

    it('has grid layout classes', () => {
      const { container } = render(<MetricsOverviewSkeleton />);
      const grid = container.firstChild as HTMLElement;
      expect(grid).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-3', 'lg:grid-cols-6');
    });
  });

  describe('WorkflowListSkeleton', () => {
    it('renders 10 workflow items', () => {
      const { container } = render(<WorkflowListSkeleton />);
      const items = container.querySelectorAll('.p-4');
      expect(items).toHaveLength(10);
    });

    it('has proper container styling', () => {
      const { container } = render(<WorkflowListSkeleton />);
      const list = container.firstChild as HTMLElement;
      expect(list).toHaveClass('bg-white', 'dark:bg-gray-800', 'rounded-lg', 'shadow');
    });
  });

  describe('LoadingTimeout', () => {
    it('renders children when not loading', () => {
      render(
        <LoadingTimeout isLoading={false}>
          <div data-testid="content">Content</div>
        </LoadingTimeout>
      );
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('renders children while loading within timeout', () => {
      render(
        <LoadingTimeout isLoading={true} timeout={1000}>
          <div data-testid="loading-content">Loading content</div>
        </LoadingTimeout>
      );
      expect(screen.getByTestId('loading-content')).toBeInTheDocument();
    });

    it('calls onTimeout after timeout period', async () => {
      const onTimeout = vi.fn();
      render(
        <LoadingTimeout isLoading={true} timeout={100} onTimeout={onTimeout}>
          <div>Loading content</div>
        </LoadingTimeout>
      );

      await waitFor(() => {
        expect(onTimeout).toHaveBeenCalled();
      }, { timeout: 200 });
    });

    it('shows timeout message after timeout', async () => {
      render(
        <LoadingTimeout isLoading={true} timeout={100}>
          <div>Loading content</div>
        </LoadingTimeout>
      );

      await waitFor(() => {
        expect(screen.getByText('Loading Timeout')).toBeInTheDocument();
      }, { timeout: 200 });
    });

    it('resets timeout when loading state changes', async () => {
      const onTimeout = vi.fn();
      const { rerender } = render(
        <LoadingTimeout isLoading={true} timeout={100} onTimeout={onTimeout}>
          <div>Loading content</div>
        </LoadingTimeout>
      );

      // Stop loading before timeout
      rerender(
        <LoadingTimeout isLoading={false} timeout={100} onTimeout={onTimeout}>
          <div>Loaded content</div>
        </LoadingTimeout>
      );

      // Wait for original timeout period
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(onTimeout).not.toHaveBeenCalled();
    });
  });
});