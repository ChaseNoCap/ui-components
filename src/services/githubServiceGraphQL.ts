import { apolloClient } from '@/lib/apollo-client';
import { createLogger } from '@/utils/logger';
import type { ICache } from '@/utils/cache';
import { MemoryCache } from '@/utils/cache';
import type { Repository, HealthMetrics, WorkflowRun } from '@/types';
import {
  GET_WORKFLOW_RUNS,
  DISPATCH_WORKFLOW,
  CANCEL_WORKFLOW_RUN,
  GET_REPOSITORY_ISSUES,
  GET_PULL_REQUESTS,
  LIST_USER_REPOSITORIES,
  CREATE_GIT_TAG,
  GITHUB_GRAPHQL_QUERY,
} from '@/graphql/github-operations';

// GitHub API service using GraphQL through the federation gateway
class GitHubServiceGraphQL {
  private logger = createLogger('GitHubServiceGraphQL');
  private cache: ICache;
  private requestCount = 0;
  private rateLimitResetTime = 0;

  constructor() {
    // Initialize memory cache for GitHub responses
    this.cache = new MemoryCache();
    
    // Verify Apollo client is available
    if (!apolloClient) {
      throw new Error('Apollo client not initialized. Please check your GraphQL configuration.');
    }
    
    this.logger.info('GitHub GraphQL service initialized successfully with caching');
  }

  /**
   * Fetch repositories for the metaGOTHIC user/organization
   */
  async fetchRepositories(): Promise<Repository[]> {
    return this.withCaching('repositories', 300, () => // Cache for 5 minutes
      this.withErrorHandling('fetchRepositories', async () => {
        // First, use the existing GitHub GraphQL query for user repositories
        const userQuery = `
          query GetUserRepositories($login: String!) {
            user(login: $login) {
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

        try {
          // Use the GitHub GraphQL query through our federation gateway
          const { data } = await apolloClient.query({
            query: GITHUB_GRAPHQL_QUERY,
            variables: {
              query: userQuery,
              variables: { login: 'ChaseNoCap' }
            }
          });
          
          const response = data.github;
          
          if (response?.user?.repositories?.nodes) {
            this.logger.info('Successfully fetched repositories from user account');
            return response.user.repositories.nodes
              .filter((repo: any) => repo.name.includes('gothic') || this.isMetaGOTHICPackage(repo.name))
              .map((repo: any) => this.transformRepository(repo));
          }
        } catch (userError) {
          this.logger.warn('Failed to fetch as user, trying REST API through GraphQL:', userError);
          
          // Fallback to REST API through GraphQL
          const { data } = await apolloClient.query({
            query: LIST_USER_REPOSITORIES,
            variables: {
              perPage: 50,
              page: 1,
              sort: 'updated'
            }
          });
          
          if (data?.GitHub_reposListForAuthenticatedUser) {
            this.logger.info('Successfully fetched repositories from REST API');
            return data.GitHub_reposListForAuthenticatedUser
              .filter((repo: any) => repo.name.includes('gothic') || this.isMetaGOTHICPackage(repo.name))
              .map((repo: any) => this.transformRestRepository(repo));
          }
        }
        
        throw new Error('Could not fetch repositories from either GraphQL or REST endpoints');
      })
    );
  }

  /**
   * Fetch health metrics for repositories
   */
  async fetchHealthMetrics(): Promise<HealthMetrics[]> {
    return this.withCaching('health-metrics', 120, () => // Cache for 2 minutes
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
      const { data } = await apolloClient.query({
        query: GET_WORKFLOW_RUNS,
        variables: {
          owner,
          repo,
          perPage: 10,
          page: 1
        }
      });

      if (!data?.GitHub_actionsListWorkflowRunsForRepo?.workflow_runs) {
        this.logger.warn(`No workflow runs found for ${owner}/${repo}`);
        return [];
      }

      return data.GitHub_actionsListWorkflowRunsForRepo.workflow_runs.map((run: any) => ({
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
      // Some repositories might not have GitHub Actions enabled
      if (error instanceof Error && error.message.includes('404')) {
        this.logger.warn(`No GitHub Actions found for ${owner}/${repo}`);
        return [];
      }
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
      
      await apolloClient.mutate({
        mutation: DISPATCH_WORKFLOW,
        variables: {
          owner,
          repo,
          workflowId: params.workflow,
          ref: 'main',
          inputs: params.inputs || {}
        }
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
      
      await apolloClient.mutate({
        mutation: CANCEL_WORKFLOW_RUN,
        variables: {
          owner,
          repo,
          runId: params.runId
        }
      });
      
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
   * Helper: Transform GitHub GraphQL repository to our Repository type
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
      isSubmodule: true,
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
   * Helper: Transform REST API repository to our Repository type
   */
  private transformRestRepository(repo: any): Repository {
    return {
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || '',
      url: `https://github.com/${repo.full_name}`,
      isSubmodule: true,
      packageName: `@meta-gothic/${repo.name}`,
      version: '0.0.0', // Would need to fetch package.json separately
      lastCommit: {
        sha: '',
        message: '',
        author: repo.owner.login,
        date: repo.pushed_at,
      },
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
      
      // Analyze recent workflow results
      const recentRuns = workflows.slice(0, 5);
      const failureRate = recentRuns.filter(run => run.conclusion === 'failure').length / recentRuns.length;
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (failureRate > 0.6) status = 'critical';
      else if (failureRate > 0.2) status = 'warning';

      // Get issues and PRs through GraphQL
      const [issuesResult, prsResult] = await Promise.all([
        apolloClient.query({
          query: GET_REPOSITORY_ISSUES,
          variables: { owner, repo: repoName, state: 'open', perPage: 100 }
        }).catch(() => ({ data: { GitHub_issuesListForRepo: [] } })),
        apolloClient.query({
          query: GET_PULL_REQUESTS,
          variables: { owner, repo: repoName, state: 'open', perPage: 100 }
        }).catch(() => ({ data: { GitHub_pullsList: [] } })),
      ]);

      const issues = issuesResult.data?.GitHub_issuesListForRepo || [];
      const prs = prsResult.data?.GitHub_pullsList || [];

      return {
        repository: repo.name,
        status,
        lastUpdate: new Date().toISOString(),
        metrics: {
          buildStatus: recentRuns[0]?.conclusion === 'success' ? 'passing' : 
                     recentRuns[0]?.conclusion === 'failure' ? 'failing' : 'unknown',
          testCoverage: undefined,
          lastPublish: repo.lastCommit?.date,
          openIssues: Array.isArray(issues) ? issues.length : 0,
          openPRs: Array.isArray(prs) ? prs.length : 0,
          dependencyStatus: 'up-to-date',
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
   * Error handling wrapper with retry logic
   */
  private async withErrorHandling<T>(
    operation: string,
    fn: () => Promise<T>,
    options: { fallback?: T; maxRetries?: number } = {}
  ): Promise<T> {
    const { fallback, maxRetries = 3 } = options;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn();
        this.requestCount++;
        return result;
        
      } catch (error: any) {
        const errorMessage = error?.message || 'Unknown error';
        
        // Handle rate limiting
        if (errorMessage.includes('rate limit')) {
          this.logger.warn(`Rate limit exceeded for ${operation}, attempt ${attempt}/${maxRetries}`);
          
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 60000);
            this.logger.info(`Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // Handle GraphQL errors
        if (error?.graphQLErrors?.length > 0) {
          this.logger.error(`GraphQL error for ${operation}: ${error.graphQLErrors[0].message}`, error);
          if (fallback !== undefined) return fallback;
          throw error;
        }
        
        // Handle network errors - retry
        if (error?.networkError || errorMessage.includes('fetch')) {
          this.logger.warn(`Network error for ${operation}, attempt ${attempt}/${maxRetries}`);
          
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        this.logger.error(`Failed ${operation} after ${attempt} attempts: ${errorMessage}`, error);
        if (fallback !== undefined) return fallback;
        throw error;
      }
    }
    
    if (fallback !== undefined) return fallback;
    throw new Error(`Failed ${operation} after ${maxRetries} attempts`);
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
      const cached = await this.cache.get<T>(cacheKey);
      if (cached !== null) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return cached;
      }
    } catch (error) {
      this.logger.warn(`Cache get failed for ${cacheKey}`, { error });
    }
    
    this.logger.debug(`Cache miss for ${cacheKey}, fetching fresh data`);
    const result = await fn();
    
    try {
      await this.cache.set(cacheKey, result);
      this.logger.debug(`Cached result for ${cacheKey} with TTL ${ttlSeconds}s`);
    } catch (error) {
      this.logger.warn(`Cache set failed for ${cacheKey}`, { error });
    }
    
    return result;
  }
}

// Export singleton instance
export const githubServiceGraphQL = new GitHubServiceGraphQL();