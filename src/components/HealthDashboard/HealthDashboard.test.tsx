import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HealthDashboard } from './index';

// Mock the API module
vi.mock('@/services/api', () => ({
  fetchRepositories: vi.fn(() => Promise.resolve([
    {
      id: '1',
      name: 'test-repo',
      fullName: 'org/test-repo',
      url: 'https://github.com/org/test-repo',
      isSubmodule: true,
    }
  ])),
  fetchHealthMetrics: vi.fn(() => Promise.resolve([
    {
      repository: 'test-repo',
      status: 'healthy',
      lastUpdate: new Date().toISOString(),
      metrics: {
        buildStatus: 'passing',
        testCoverage: 85,
      },
      workflows: [],
    }
  ])),
}));

describe('HealthDashboard', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const renderComponent = () => {
    render(
      <QueryClientProvider client={queryClient}>
        <HealthDashboard />
      </QueryClientProvider>
    );
  };

  it('renders the dashboard header', () => {
    renderComponent();
    expect(screen.getByText('metaGOTHIC Health Monitor')).toBeInTheDocument();
  });

  it('displays repository data after loading', async () => {
    renderComponent();
    
    // Wait for the data to load
    const repoCard = await screen.findByText('test-repo');
    expect(repoCard).toBeInTheDocument();
    
    // Check if health status is displayed (there are multiple, so use getAllByText)
    const healthyElements = screen.getAllByText('healthy');
    expect(healthyElements.length).toBeGreaterThan(0);
  });
});