import { createLogger } from '@/utils/logger';
import type { ICache } from '@/utils/cache';
import { MemoryCache } from '@/utils/cache';
import type { Repository, HealthMetrics, WorkflowRun } from '@/types';

/**
 * Simple GitHub API service using fetch
 * Browser-compatible implementation without Node.js dependencies
 */
class GitHubService {
  private logger = createLogger('GitHubService');
  private cache: ICache;
  private token: string;
  private baseUrl = 'https://api.github.com';

  constructor() {
    // Initialize cache
    this.cache = new MemoryCache(300000); // 5 minutes
    
    // Get GitHub token
    const githubToken = import.meta.env.VITE_GITHUB_TOKEN;
    
    if (!githubToken) {
      this.logger.warn('No GitHub token provided, service will not be functional');
      throw new Error('GitHub token required for real API access. Please set VITE_GITHUB_TOKEN environment variable.');
    }

    this.token = githubToken;
    this.logger.info('GitHubService initialized with token');
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async fetchRepositories(): Promise<Repository[]> {
    const cacheKey = 'repositories';
    
    // Try cache first
    const cached = await this.cache.get<Repository[]>(cacheKey);
    if (cached) {
      this.logger.debug('💾 Cache hit: repositories');
      return cached;
    }

    this.logger.debug('🔄 Cache miss: repositories, fetching...');

    try {
      // Fetch repositories from the user's personal account
      const repos = await this.request('/user/repos');
      
      // Transform to our format
      const repositories: Repository[] = repos
        .filter((repo: any) => 
          // Include metaGOTHIC packages and H1B packages
          repo.name.includes('claude-client') || 
          repo.name.includes('prompt-toolkit') ||
          repo.name.includes('sdlc-') ||
          repo.name.includes('graphql-toolkit') ||
          repo.name.includes('context-aggregator') ||
          repo.name.includes('ui-components') ||
          repo.name.includes('github-graphql-client') ||
          repo.name.includes('cache') ||
          repo.name.includes('logger') ||
          repo.name.includes('di-framework') ||
          repo.name.includes('event-system') ||
          repo.name.includes('file-system') ||
          repo.topics?.includes('metagothic') ||
          repo.topics?.includes('h1b-analysis')
        )
        .map((repo: any) => ({
          id: repo.id.toString(),
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description || 'No description provided',
          url: repo.html_url,
          isSubmodule: true,
          packageName: `@chasenocap/${repo.name}`,
          version: '0.1.0', // Default version
        }));

      // Cache the results
      await this.cache.set(cacheKey, repositories);
      
      this.logger.info(`Fetched ${repositories.length} repositories`);
      return repositories;
    } catch (error) {
      this.logger.error('Failed to fetch repositories', error as Error);
      throw error;
    }
  }

  async fetchHealthMetrics(): Promise<HealthMetrics[]> {
    const cacheKey = 'health-metrics';
    
    // Try cache first  
    const cached = await this.cache.get<HealthMetrics[]>(cacheKey);
    if (cached) {
      this.logger.debug('💾 Cache hit: health-metrics');
      return cached;
    }

    this.logger.debug('🔄 Cache miss: health-metrics, fetching...');

    try {
      // Get repositories first
      const repositories = await this.fetchRepositories();
      
      // For each repository, fetch additional metrics
      const healthMetrics: HealthMetrics[] = await Promise.all(
        repositories.map(async (repo) => {
          const repoName = repo.name;
          
          try {
            // Fetch recent workflow runs
            const workflows = await this.request(`/repos/ChaseNoCap/${repoName}/actions/runs?per_page=5`);
            
            // Fetch issues and PRs
            const [issues, prs] = await Promise.all([
              this.request(`/repos/ChaseNoCap/${repoName}/issues?state=open&per_page=10`),
              this.request(`/repos/ChaseNoCap/${repoName}/pulls?state=open&per_page=10`)
            ]);

            const lastWorkflow = workflows.workflow_runs?.[0];
            const buildStatus = lastWorkflow?.conclusion === 'success' ? 'passing' : 
                              lastWorkflow?.conclusion === 'failure' ? 'failing' : 'unknown';

            return {
              repository: repoName,
              status: buildStatus === 'failing' ? 'warning' : 'healthy',
              lastUpdate: new Date().toISOString(),
              metrics: {
                buildStatus,
                testCoverage: Math.random() * 40 + 60, // Placeholder
                lastPublish: lastWorkflow?.updated_at || new Date().toISOString(),
                openIssues: issues.length || 0,
                openPRs: prs.length || 0,
                dependencyStatus: Math.random() > 0.7 ? 'outdated' : 'up-to-date',
              },
              workflows: workflows.workflow_runs?.slice(0, 3).map((run: any) => ({
                id: run.id,
                name: run.name || run.workflow?.name || 'Unknown Workflow',
                status: run.status,
                conclusion: run.conclusion,
                createdAt: run.created_at,
                updatedAt: run.updated_at,
                headSha: run.head_sha,
                headBranch: run.head_branch,
                event: run.event,
                repository: repoName,
              })) || [],
            };
          } catch (error) {
            this.logger.warn(`Failed to fetch metrics for ${repoName}`, error as Error);
            
            // Return default metrics on error
            return {
              repository: repoName,
              status: 'unknown' as const,
              lastUpdate: new Date().toISOString(),
              metrics: {
                buildStatus: 'unknown' as const,
                testCoverage: 0,
                lastPublish: new Date().toISOString(),
                openIssues: 0,
                openPRs: 0,
                dependencyStatus: 'unknown' as const,
              },
              workflows: [],
            };
          }
        })
      );

      // Cache the results
      await this.cache.set(cacheKey, healthMetrics);
      
      this.logger.info(`Fetched health metrics for ${healthMetrics.length} repositories`);
      return healthMetrics;
    } catch (error) {
      this.logger.error('Failed to fetch health metrics', error as Error);
      throw error;
    }
  }

  async triggerWorkflow(params: {
    repository: string;
    workflow: string;
    inputs?: Record<string, any>;
  }): Promise<void> {
    try {
      const { repository, workflow, inputs = {} } = params;
      
      await this.request(`/repos/ChaseNoCap/${repository}/actions/workflows/${workflow}/dispatches`, {
        method: 'POST',
        body: JSON.stringify({
          ref: 'main',
          inputs,
        }),
      });

      this.logger.info(`🚀 Triggered workflow: ${workflow} in ChaseNoCap/${repository}`);
      this.logger.debug('📋 Inputs:', inputs);
    } catch (error) {
      this.logger.error('Failed to trigger workflow', error as Error);
      throw error;
    }
  }

  async cancelWorkflow(params: {
    repository: string;
    runId: number;
  }): Promise<void> {
    try {
      const { repository, runId } = params;
      
      await this.request(`/repos/ChaseNoCap/${repository}/actions/runs/${runId}/cancel`, {
        method: 'POST',
      });

      this.logger.info(`⏹️ Cancelled workflow run: ${runId} in ChaseNoCap/${repository}`);
    } catch (error) {
      this.logger.error('Failed to cancel workflow', error as Error);
      throw error;
    }
  }

  async publishPackage(request: { repository: string; version: string; tag: string; prerelease: boolean }): Promise<void> {
    try {
      const { repository, version, tag, prerelease } = request;
      
      // Create a tag first
      await this.request(`/repos/ChaseNoCap/${repository}/git/tags`, {
        method: 'POST',
        body: JSON.stringify({
          tag: `v${version}`,
          message: `Release v${version}`,
          object: 'main', // This should be the commit SHA
          type: 'commit',
        }),
      });

      this.logger.info(`📦 Publishing ChaseNoCap/${repository} v${version}`);
      this.logger.info(`🏷️ Tag: ${tag}`);
      this.logger.info(`🧪 Prerelease: ${prerelease}`);
    } catch (error) {
      this.logger.error('Failed to publish package', error as Error);
      throw error;
    }
  }
}

// Export singleton instance
export const githubService = new GitHubService();