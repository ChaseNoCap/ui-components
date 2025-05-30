import { githubService } from './githubService';

export interface FetchOptions {
  retryAttempts?: number;
  retryDelay?: number;
  onError?: (error: Error) => void;
  onRetry?: (attempt: number, error: Error) => void;
}

export interface FetchResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
}

export class DataFetchError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'DataFetchError';
  }
}

class DataFetcher {
  private defaultOptions: FetchOptions = {
    retryAttempts: 3,
    retryDelay: 1000,
  };

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fetchWithRetry<T>(
    fetchFn: () => Promise<T>,
    options: FetchOptions = {}
  ): Promise<T> {
    const { retryAttempts, retryDelay, onRetry } = { ...this.defaultOptions, ...options };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retryAttempts!; attempt++) {
      try {
        return await fetchFn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < retryAttempts! - 1) {
          onRetry?.(attempt + 1, lastError);
          await this.sleep(retryDelay! * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }

    throw lastError;
  }

  async fetchRepositories(options: FetchOptions = {}): Promise<FetchResult<any[]>> {
    const { onError } = { ...this.defaultOptions, ...options };
    
    try {
      const data = await this.fetchWithRetry(() => githubService.fetchRepositories(), options);
      
      return {
        data,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
      };
    } catch (error) {
      const fetchError = new DataFetchError(
        'Failed to fetch repositories',
        'FETCH_REPOSITORIES_ERROR',
        undefined,
        error
      );
      
      onError?.(fetchError);
      
      return {
        data: null,
        error: fetchError,
        isLoading: false,
        isError: true,
        isSuccess: false,
      };
    }
  }

  async fetchHealthMetrics(options: FetchOptions = {}): Promise<FetchResult<any[]>> {
    const { onError } = { ...this.defaultOptions, ...options };
    
    try {
      const data = await this.fetchWithRetry(() => githubService.fetchHealthMetrics(), options);
      
      return {
        data,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
      };
    } catch (error) {
      const fetchError = new DataFetchError(
        'Failed to fetch health metrics',
        'FETCH_HEALTH_METRICS_ERROR',
        undefined,
        error
      );
      
      onError?.(fetchError);
      
      return {
        data: null,
        error: fetchError,
        isLoading: false,
        isError: true,
        isSuccess: false,
      };
    }
  }

  async fetchWorkflowRuns(repoName: string, options: FetchOptions = {}): Promise<FetchResult<any[]>> {
    const { onError } = { ...this.defaultOptions, ...options };
    
    try {
      const data = await this.fetchWithRetry(() => githubService.fetchWorkflowRuns(repoName), options);
      
      return {
        data,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
      };
    } catch (error) {
      const fetchError = new DataFetchError(
        `Failed to fetch workflow runs for ${repoName}`,
        'FETCH_WORKFLOWS_ERROR',
        undefined,
        error
      );
      
      onError?.(fetchError);
      
      return {
        data: null,
        error: fetchError,
        isLoading: false,
        isError: true,
        isSuccess: false,
      };
    }
  }

  async triggerWorkflow(
    repoName: string,
    workflowFile: string,
    options: FetchOptions = {}
  ): Promise<FetchResult<boolean>> {
    const { onError } = { ...this.defaultOptions, ...options };
    
    try {
      const data = await this.fetchWithRetry(
        () => githubService.triggerWorkflow(repoName, workflowFile),
        options
      );
      
      return {
        data,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
      };
    } catch (error) {
      const fetchError = new DataFetchError(
        `Failed to trigger workflow ${workflowFile} for ${repoName}`,
        'TRIGGER_WORKFLOW_ERROR',
        undefined,
        error
      );
      
      onError?.(fetchError);
      
      return {
        data: false,
        error: fetchError,
        isLoading: false,
        isError: true,
        isSuccess: false,
      };
    }
  }

  // Check if GitHub token is available
  hasGitHubToken(): boolean {
    return !!import.meta.env.VITE_GITHUB_TOKEN;
  }
}

export const dataFetcher = new DataFetcher();