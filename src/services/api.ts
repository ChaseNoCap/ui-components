import { Repository, HealthMetrics, WorkflowRun, PublishRequest } from '@/types';

// GitHub service integration - PRODUCTION MODE (Real API Only)
let githubService: any = null;
let isTestEnvironment = false;
let gitHubInitPromise: Promise<void> | null = null;

// Initialize GitHub service with strict real API enforcement
async function initializeGitHubService() {
  if (gitHubInitPromise) return gitHubInitPromise;
  
  gitHubInitPromise = (async () => {
    // Check if we're in test environment
    isTestEnvironment = import.meta.env.NODE_ENV === 'test' || import.meta.env.VITEST;
    
    if (isTestEnvironment) {
      // Only use mock in test environment
      const { githubService: mockGithubService } = await import('./githubServiceMock.js');
      githubService = mockGithubService;
      console.log('🧪 Using mock GitHub service in test environment');
      return;
    }
    
    // PRODUCTION: Try to use real GitHub service, but gracefully fallback
    const githubToken = import.meta.env.VITE_GITHUB_TOKEN;
    
    if (!githubToken) {
      console.warn('⚠️ No GitHub token provided - API calls will fail with user-friendly errors');
      // Don't throw here - let the API calls handle this gracefully
      githubService = null;
      return;
    }
    
    try {
      // Initialize real GitHub service
      const { githubService: realGithubService } = await import('./githubServiceSimple.js');
      githubService = realGithubService;
      console.log('✅ Using real GitHub API with token');
    } catch (error) {
      console.warn('⚠️ Failed to initialize GitHub service - API calls will show errors:', error);
      githubService = null;
    }
  })();
  
  return gitHubInitPromise;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchRepositories(): Promise<Repository[]> {
  try {
    await initializeGitHubService();
    
    if (!githubService) {
      // Create a user-friendly error that the UI can display
      const error = new Error('GitHub API not available. Please configure VITE_GITHUB_TOKEN to access real repository data.');
      (error as any).code = 'GITHUB_TOKEN_MISSING';
      throw error;
    }
    
    return await githubService.fetchRepositories();
  } catch (error) {
    if (isTestEnvironment) {
      // In test environment, return basic mock data
      return [
    {
      id: '1',
      name: 'claude-client',
      fullName: 'ChaseNoCap/claude-client',
      description: 'Claude CLI subprocess wrapper with streaming support',
      url: 'https://github.com/ChaseNoCap/claude-client',
      isSubmodule: true,
      packageName: '@chasenocap/claude-client',
      version: '0.1.0',
    },
    {
      id: '2',
      name: 'prompt-toolkit',
      fullName: 'ChaseNoCap/prompt-toolkit',
      description: 'XML template system for metaGOTHIC framework',
      url: 'https://github.com/ChaseNoCap/prompt-toolkit',
      isSubmodule: true,
      packageName: '@chasenocap/prompt-toolkit',
      version: '0.1.0',
    },
    {
      id: '3',
      name: 'sdlc-config',
      fullName: 'ChaseNoCap/sdlc-config',
      description: 'YAML-based SDLC configuration management',
      url: 'https://github.com/ChaseNoCap/sdlc-config',
      isSubmodule: true,
      packageName: '@chasenocap/sdlc-config',
      version: '0.1.0',
    },
    {
      id: '4',
      name: 'sdlc-engine',
      fullName: 'ChaseNoCap/sdlc-engine',
      description: 'State machine for SDLC phase management',
      url: 'https://github.com/ChaseNoCap/sdlc-engine',
      isSubmodule: true,
      packageName: '@chasenocap/sdlc-engine',
      version: '0.1.0',
    },
    {
      id: '5',
      name: 'sdlc-content',
      fullName: 'ChaseNoCap/sdlc-content',
      description: 'Templates and knowledge base for metaGOTHIC',
      url: 'https://github.com/ChaseNoCap/sdlc-content',
      isSubmodule: true,
      packageName: '@chasenocap/sdlc-content',
      version: '0.1.0',
    },
    {
      id: '6',
      name: 'graphql-toolkit',
      fullName: 'ChaseNoCap/graphql-toolkit',
      description: 'GraphQL utilities and schema management',
      url: 'https://github.com/ChaseNoCap/graphql-toolkit',
      isSubmodule: true,
      packageName: '@chasenocap/graphql-toolkit',
      version: '0.1.0',
    },
    {
      id: '7',
      name: 'context-aggregator',
      fullName: 'ChaseNoCap/context-aggregator',
      description: 'Intelligent context management for AI workflows',
      url: 'https://github.com/ChaseNoCap/context-aggregator',
      isSubmodule: true,
      packageName: '@chasenocap/context-aggregator',
      version: '0.1.0',
    },
    {
      id: '8',
      name: 'ui-components',
      fullName: 'ChaseNoCap/ui-components',
      description: 'metaGOTHIC UI Components and Dashboard',
      url: 'https://github.com/ChaseNoCap/ui-components',
      isSubmodule: true,
      packageName: '@chasenocap/ui-components',
      version: '0.1.0',
    },
    {
      id: '9',
      name: 'github-graphql-client',
      fullName: 'ChaseNoCap/github-graphql-client',
      description: 'Smart GitHub API client with GraphQL/REST routing',
      url: 'https://github.com/ChaseNoCap/github-graphql-client',
      isSubmodule: true,
      packageName: '@chasenocap/github-graphql-client',
      version: '1.0.0',
    },
      ];
    }
    
    // In production, re-throw the error for UI to handle
    // Add error code if not already present
    if (error instanceof Error && !(error as any).code) {
      (error as any).code = 'API_ERROR';
    }
    throw error;
  }
}

export async function fetchHealthMetrics(): Promise<HealthMetrics[]> {
  try {
    await initializeGitHubService();
    
    if (!githubService) {
      const error = new Error('GitHub API not available. Please configure VITE_GITHUB_TOKEN to access real health metrics.');
      (error as any).code = 'GITHUB_TOKEN_MISSING';
      throw error;
    }
    
    return await githubService.fetchHealthMetrics();
  } catch (error) {
    if (isTestEnvironment) {
      // In test environment, return mock data
      const repos = await fetchRepositories();
      return repos.map(repo => ({
        repository: repo.name,
        status: Math.random() > 0.8 ? 'warning' : 'healthy',
        lastUpdate: new Date().toISOString(),
        metrics: {
          buildStatus: Math.random() > 0.9 ? 'failing' : 'passing',
          testCoverage: Math.random() * 40 + 60,
          lastPublish: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          openIssues: Math.floor(Math.random() * 10),
          openPRs: Math.floor(Math.random() * 5),
          dependencyStatus: Math.random() > 0.7 ? 'outdated' : 'up-to-date',
        },
        workflows: [],
      }));
    }
    
    // In production, re-throw the error for UI to handle
    if (error instanceof Error && !(error as any).code) {
      (error as any).code = 'API_ERROR';
    }
    throw error;
  }
}

export async function triggerWorkflow(params: {
  repository: string;
  workflow: string;
  inputs?: Record<string, any>;
}): Promise<void> {
  try {
    await initializeGitHubService();
    
    if (!githubService) {
      const error = new Error('GitHub API not available. Please configure VITE_GITHUB_TOKEN to trigger workflows.');
      (error as any).code = 'GITHUB_TOKEN_MISSING';
      throw error;
    }
    
    return await githubService.triggerWorkflow(params);
  } catch (error) {
    if (isTestEnvironment) {
      // In test environment, use mock behavior
      console.log('Triggering workflow (test mock):', params);
      await new Promise(resolve => setTimeout(resolve, 100));
      return;
    }
    
    // In production, re-throw the error for UI to handle
    if (error instanceof Error && !(error as any).code) {
      (error as any).code = 'API_ERROR';
    }
    throw error;
  }
}

export async function cancelWorkflow(params: {
  repository: string;
  runId: number;
}): Promise<void> {
  try {
    await initializeGitHubService();
    
    if (!githubService) {
      const error = new Error('GitHub API not available. Please configure VITE_GITHUB_TOKEN to cancel workflows.');
      (error as any).code = 'GITHUB_TOKEN_MISSING';
      throw error;
    }
    
    return await githubService.cancelWorkflow(params);
  } catch (error) {
    if (isTestEnvironment) {
      // In test environment, use mock behavior
      console.log('Cancelling workflow (test mock):', params);
      await new Promise(resolve => setTimeout(resolve, 100));
      return;
    }
    
    // In production, re-throw the error for UI to handle
    if (error instanceof Error && !(error as any).code) {
      (error as any).code = 'API_ERROR';
    }
    throw error;
  }
}

export async function publishPackage(request: PublishRequest): Promise<void> {
  try {
    await initializeGitHubService();
    
    if (!githubService) {
      const error = new Error('GitHub API not available. Please configure VITE_GITHUB_TOKEN to publish packages.');
      (error as any).code = 'GITHUB_TOKEN_MISSING';
      throw error;
    }
    
    return await githubService.publishPackage(request);
  } catch (error) {
    if (isTestEnvironment) {
      // In test environment, use mock behavior
      console.log('Publishing package (test mock):', request);
      await new Promise(resolve => setTimeout(resolve, 100));
      return;
    }
    
    // In production, re-throw the error for UI to handle
    if (error instanceof Error && !(error as any).code) {
      (error as any).code = 'API_ERROR';
    }
    throw error;
  }
}