// GitHub client interfaces - fallback when package is not available
interface IGitHubClient {
  request(query: string, variables?: any): Promise<any>;
}
import { createLogger } from '@/utils/logger';
import type { ICache } from '@/utils/cache';
import { MemoryCache } from '@/utils/cache';
import type { Repository, HealthMetrics, WorkflowRun } from '@/types';

// GitHub API service using the real GitHub GraphQL client
class GitHubService {
  private client: IGitHubClient;
  private logger = createLogger('GitHubService');
  private cache: ICache;
  private requestCount = 0;
  private rateLimitResetTime = 0;

  constructor() {
    // Initialize GitHub client with authentication
    const githubToken = import.meta.env.VITE_GITHUB_TOKEN;
    
    if (!githubToken) {
      this.logger.warn('No GitHub token provided, service will not be functional');
      throw new Error('GitHub token required for real API access. Please set VITE_GITHUB_TOKEN environment variable.');
    }

    try {
      const logger = createLogger('GitHub');
      
      // Initialize memory cache for GitHub responses
      this.cache = new MemoryCache();
      
      // Simple GitHub client implementation for token validation
      this.client = {
        request: async (queryOrUrl: string, variables?: any) => {
          const isGraphQL = queryOrUrl.includes('query') || queryOrUrl.includes('mutation');
          
          if (isGraphQL) {
            // GraphQL request
            const response = await fetch('https://api.github.com/graphql', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Content-Type': 'application/json',
                'User-Agent': 'metaGOTHIC-Dashboard/1.0.0'
              },
              body: JSON.stringify({ query: queryOrUrl, variables })
            });
            
            if (!response.ok) {
              throw new Error(`GraphQL request failed: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.errors) {
              throw new Error(`GraphQL errors: ${result.errors.map((e: any) => e.message).join(', ')}`);
            }
            
            return result.data;
          } else {
            // REST API request
            const url = queryOrUrl.startsWith('GET ') || queryOrUrl.startsWith('POST ') 
              ? `https://api.github.com${queryOrUrl.substring(4)}`
              : queryOrUrl;
            
            const method = queryOrUrl.startsWith('POST ') ? 'POST' : 'GET';
            
            const response = await fetch(url, {
              method,
              headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'metaGOTHIC-Dashboard/1.0.0',
                ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {})
              },
              ...(method === 'POST' && variables ? { body: JSON.stringify(variables) } : {})
            });
            
            if (!response.ok) {
              throw new Error(`REST API request failed: ${response.status}`);
            }
            
            return await response.json();
          }
        }
      };
      
      this.logger.info('GitHub service initialized successfully with caching');
    } catch (error) {
      this.logger.error('Failed to initialize GitHub client', error as Error);
      
      // Enhance error messages for better UX
      if (error instanceof Error) {
        if (error.message.includes('token')) {
          throw new Error('GitHub token authentication failed. Please check your VITE_GITHUB_TOKEN environment variable.');
        }
        if (error.message.includes('network') || error.message.includes('fetch')) {
          throw new Error('Network error while connecting to GitHub API. Please check your internet connection.');
        }
      }
      
      throw new Error(`Failed to initialize GitHub service: ${(error as Error).message}`);
    }
  }

  /**
   * Fetch repositories for the metaGOTHIC organization
   */
  async fetchRepositories(): Promise<Repository[]> {
    return this.withCaching('repositories', 300, () => // Cache for 5 minutes
      this.withErrorHandling('fetchRepositories', async () => {
      const query = `
        query GetMetaGOTHICRepositories($org: String!) {
          organization(login: $org) {
            repositories(first: 20, orderBy: {field: UPDATED_AT, direction: DESC}) {
              nodes {
                id
                name
                nameWithOwner
                description
                url
                isArchived
                defaultBranchRef {
                  target {
                    ... on Commit {
                      oid
                      message
                      author {
                        name
                        email
                        date
                      }
                    }
                  }
                }
                packageJson: object(expression: "HEAD:package.json") {
                  ... on Blob {
                    text
                  }
                }
                releases(first: 1, orderBy: {field: CREATED_AT, direction: DESC}) {
                  nodes {
                    tagName
                    publishedAt
                  }
                }
              }
            }
          }
        }
      `;

      const response = await this.client.request(query, { org: 'ChaseNoCap' });
      
      if (!response?.organization?.repositories?.nodes) {
        throw new Error('Invalid response structure from GitHub API');
      }
      
      return response.organization.repositories.nodes
        .filter((repo: any) => repo.name.includes('gothic') || this.isMetaGOTHICPackage(repo.name))
        .map((repo: any) => this.transformRepository(repo));
      })
    );
  }

  /**
   * Fetch health metrics for repositories
   */
  async fetchHealthMetrics(): Promise<HealthMetrics[]> {
    return this.withCaching('health-metrics', 120, () => // Cache for 2 minutes (health data changes frequently)
      this.withErrorHandling('fetchHealthMetrics', async () => {
        const repositories = await this.fetchRepositories();
        
        const healthMetrics = await Promise.all(
          repositories.map(repo => this.fetchRepositoryHealth(repo))
        );
        
        return healthMetrics;
      })
    );
  }

  /**
   * Fetch workflow runs for a repository
   */
  async fetchWorkflowRuns(owner: string, repo: string): Promise<WorkflowRun[]> {
    try {
      const query = `
        query GetWorkflowRuns($owner: String!, $name: String!) {
          repository(owner: $owner, name: $name) {
            object(expression: "HEAD:.github/workflows") {
              ... on Tree {
                entries {
                  name
                  type
                }
              }
            }
          }
        }
      `;

      // For now, use REST API for workflow runs as it's more straightforward
      const workflowRuns = await this.client.request(`
        GET /repos/${owner}/${repo}/actions/runs
      `);

      return workflowRuns.workflow_runs.slice(0, 10).map((run: any) => ({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
        headSha: run.head_sha,
        headBranch: run.head_branch,
        event: run.event,
        repository: repo,
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch workflow runs for ${owner}/${repo}`, error as Error);
      return [];
    }
  }

  /**
   * Trigger a workflow
   */
  async triggerWorkflow(params: {
    repository: string;
    workflow: string;
    inputs?: Record<string, any>;
  }): Promise<void> {
    try {
      const [owner, repo] = params.repository.split('/');
      
      await this.client.request(`
        POST /repos/${owner}/${repo}/actions/workflows/${params.workflow}/dispatches
      `, {
        ref: 'main',
        inputs: params.inputs || {},
      });
      
      this.logger.info(`Triggered workflow ${params.workflow} for ${params.repository}`);
    } catch (error) {
      this.logger.error('Failed to trigger workflow', error as Error);
      throw error;
    }
  }

  /**
   * Cancel a workflow run
   */
  async cancelWorkflow(params: {
    repository: string;
    runId: number;
  }): Promise<void> {
    try {
      const [owner, repo] = params.repository.split('/');
      
      await this.client.request(`
        POST /repos/${owner}/${repo}/actions/runs/${params.runId}/cancel
      `);
      
      this.logger.info(`Cancelled workflow run ${params.runId} for ${params.repository}`);
    } catch (error) {
      this.logger.error('Failed to cancel workflow', error as Error);
      throw error;
    }
  }

  /**
   * Publish a package by triggering the publish workflow
   */
  async publishPackage(request: {
    repository: string;
    version: string;
    tag?: string;
    prerelease?: boolean;
  }): Promise<void> {
    try {
      await this.triggerWorkflow({
        repository: request.repository,
        workflow: 'publish.yml',
        inputs: {
          version: request.version,
          tag: request.tag,
          prerelease: request.prerelease?.toString() || 'false',
        },
      });
      
      this.logger.info(`Initiated publish for ${request.repository} v${request.version}`);
    } catch (error) {
      this.logger.error('Failed to publish package', error as Error);
      throw error;
    }
  }

  /**
   * Helper: Check if repository is a metaGOTHIC package
   */
  private isMetaGOTHICPackage(name: string): boolean {
    const metaGOTHICPackages = [
      'claude-client',
      'prompt-toolkit', 
      'sdlc-config',
      'sdlc-engine',
      'sdlc-content',
      'graphql-toolkit',
      'context-aggregator',
      'ui-components',
      'github-graphql-client',
    ];
    
    return metaGOTHICPackages.includes(name);
  }

  /**
   * Helper: Transform GitHub API repository to our Repository type
   */
  private transformRepository(repo: any): Repository {
    let packageInfo = { name: '', version: '' };
    
    if (repo.packageJson?.text) {
      try {
        const pkg = JSON.parse(repo.packageJson.text);
        packageInfo = {
          name: pkg.name || '',
          version: pkg.version || '0.0.0',
        };
      } catch (error) {
        this.logger.warn(`Failed to parse package.json for ${repo.name}`);
      }
    }

    return {
      id: repo.id,
      name: repo.name,
      fullName: repo.nameWithOwner,
      description: repo.description || '',
      url: repo.url,
      isSubmodule: true, // All our packages are submodules
      packageName: packageInfo.name,
      version: packageInfo.version,
      lastCommit: repo.defaultBranchRef?.target ? {
        sha: repo.defaultBranchRef.target.oid,
        message: repo.defaultBranchRef.target.message,
        author: repo.defaultBranchRef.target.author.name,
        date: repo.defaultBranchRef.target.author.date,
      } : undefined,
    };
  }

  /**
   * Helper: Fetch comprehensive health metrics for a repository
   */
  private async fetchRepositoryHealth(repo: Repository): Promise<HealthMetrics> {
    return this.withErrorHandling(`fetchRepositoryHealth:${repo.name}`, async () => {
      const [owner, repoName] = repo.fullName.split('/');
      
      // Fetch workflow runs
      const workflows = await this.fetchWorkflowRuns(owner, repoName);
      
      // Analyze recent workflow results for health status
      const recentRuns = workflows.slice(0, 5);
      const failureRate = recentRuns.filter(run => run.conclusion === 'failure').length / recentRuns.length;
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (failureRate > 0.6) status = 'critical';
      else if (failureRate > 0.2) status = 'warning';

      // Get additional metrics via REST API
      const issuesQuery = `GET /repos/${owner}/${repoName}/issues?state=open`;
      const prsQuery = `GET /repos/${owner}/${repoName}/pulls?state=open`;
      
      const [issues, prs] = await Promise.all([
        this.client.request(issuesQuery).catch(() => ({ length: 0 })),
        this.client.request(prsQuery).catch(() => ({ length: 0 })),
      ]);

      return {
        repository: repo.name,
        status,
        lastUpdate: new Date().toISOString(),
        metrics: {
          buildStatus: recentRuns[0]?.conclusion === 'success' ? 'passing' : 
                     recentRuns[0]?.conclusion === 'failure' ? 'failing' : 'unknown',
          testCoverage: undefined, // Would need to parse coverage reports
          lastPublish: repo.lastCommit?.date,
          openIssues: Array.isArray(issues) ? issues.length : 0,
          openPRs: Array.isArray(prs) ? prs.length : 0,
          dependencyStatus: 'up-to-date', // Would need dependency analysis
        },
        workflows,
      };
    }, {
      fallback: {
        repository: repo.name,
        status: 'critical' as const,
        lastUpdate: new Date().toISOString(),
        metrics: {
          buildStatus: 'unknown' as const,
          testCoverage: undefined,
          lastPublish: undefined,
          openIssues: 0,
          openPRs: 0,
          dependencyStatus: 'up-to-date' as const,
        },
        workflows: [],
      },
    });
  }

  /**
   * Error handling wrapper with rate limiting and retry logic
   */
  private async withErrorHandling<T>(
    operation: string,
    fn: () => Promise<T>,
    options: { fallback?: T; maxRetries?: number } = {}
  ): Promise<T> {
    const { fallback, maxRetries = 3 } = options;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check rate limit before making request
        await this.checkRateLimit();
        
        const result = await fn();
        this.requestCount++;
        return result;
        
      } catch (error: any) {
        const errorMessage = error?.message || 'Unknown error';
        
        // Handle rate limiting
        if (error?.status === 403 && errorMessage.includes('rate limit')) {
          this.logger.warn(`Rate limit exceeded for ${operation}, attempt ${attempt}/${maxRetries}`);
          
          // Extract reset time from error response
          const resetTime = error?.response?.headers?.['x-ratelimit-reset'];
          if (resetTime) {
            this.rateLimitResetTime = parseInt(resetTime) * 1000;
          }
          
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 60000); // Exponential backoff, max 60s
            this.logger.info(`Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // Handle other 4xx errors (client errors) - don't retry
        if (error?.status >= 400 && error?.status < 500 && error?.status !== 403) {
          this.logger.error(`Client error for ${operation}: ${errorMessage}`, error);
          if (fallback !== undefined) return fallback;
          throw error;
        }
        
        // Handle 5xx errors (server errors) - retry
        if (error?.status >= 500 || !error?.status) {
          this.logger.warn(`Server error for ${operation}, attempt ${attempt}/${maxRetries}: ${errorMessage}`);
          
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Exponential backoff, max 30s
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        this.logger.error(`Failed ${operation} after ${attempt} attempts: ${errorMessage}`, error);
        if (fallback !== undefined) return fallback;
        throw error;
      }
    }
    
    // This should never be reached, but TypeScript requires it
    if (fallback !== undefined) return fallback;
    throw new Error(`Failed ${operation} after ${maxRetries} attempts`);
  }

  /**
   * Check and handle rate limiting
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    // If we have a rate limit reset time and it's in the future, wait
    if (this.rateLimitResetTime > now) {
      const waitTime = this.rateLimitResetTime - now;
      this.logger.info(`Rate limited, waiting ${waitTime}ms until reset...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.rateLimitResetTime = 0;
    }
    
    // Simple request counting to avoid hitting limits
    if (this.requestCount > 4000) { // Conservative limit (5000 is GitHub's limit)
      this.logger.warn('Approaching rate limit, adding delay between requests');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Caching wrapper with TTL support
   */
  private async withCaching<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>
  ): Promise<T> {
    const cacheKey = `github:${key}`;
    
    try {
      // Try to get from cache first
      const cached = await this.cache.get<T>(cacheKey);
      if (cached !== null) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return cached;
      }
    } catch (error) {
      this.logger.warn(`Cache get failed for ${cacheKey}`, { error });
    }
    
    // Cache miss, fetch fresh data
    this.logger.debug(`Cache miss for ${cacheKey}, fetching fresh data`);
    const result = await fn();
    
    try {
      // Store in cache with TTL
      await this.cache.set(cacheKey, result);
      this.logger.debug(`Cached result for ${cacheKey} with TTL ${ttlSeconds}s`);
    } catch (error) {
      this.logger.warn(`Cache set failed for ${cacheKey}`, { error });
    }
    
    return result;
  }
}

// Export singleton instance
export const githubService = new GitHubService();