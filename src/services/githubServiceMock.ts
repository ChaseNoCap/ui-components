import type { Repository, HealthMetrics, WorkflowRun } from '@/types';

/**
 * Mock GitHub service that demonstrates the real API integration pattern
 * This shows exactly how the real service would work with actual GitHub APIs
 */
class MockGitHubService {
  private requestCount = 0;
  private cache = new Map<string, { data: any; expires: number }>();

  constructor() {
    console.log('✅ GitHub API Integration Ready (Mock Mode)');
    console.log('💡 Add VITE_GITHUB_TOKEN to .env.local for real GitHub API');
  }

  /**
   * Fetch repositories - simulates real GitHub GraphQL query
   */
  async fetchRepositories(): Promise<Repository[]> {
    return this.withCaching('repositories', 300, async () => {
      // Simulate API delay
      await this.delay(200);
      this.requestCount++;

      // This would be the real GraphQL query:
      /*
      const query = `
        query GetMetaGOTHICRepositories($org: String!) {
          organization(login: $org) {
            repositories(first: 20, orderBy: {field: UPDATED_AT, direction: DESC}) {
              nodes {
                id, name, nameWithOwner, description, url, isArchived
                defaultBranchRef { target { ... on Commit { oid, message, author { name, date } } } }
                packageJson: object(expression: "HEAD:package.json") { ... on Blob { text } }
              }
            }
          }
        }
      `;
      */

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
          lastCommit: {
            sha: 'abc123',
            message: 'feat: add streaming support',
            author: 'ChaseNoCap',
            date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          },
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
          lastCommit: {
            sha: 'def456',
            message: 'feat: add XML template parser',
            author: 'ChaseNoCap',
            date: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          },
        },
        {
          id: '3',
          name: 'github-graphql-client',
          fullName: 'ChaseNoCap/github-graphql-client',
          description: 'Smart GitHub API client with GraphQL/REST routing',
          url: 'https://github.com/ChaseNoCap/github-graphql-client',
          isSubmodule: true,
          packageName: '@chasenocap/github-graphql-client',
          version: '1.0.0',
          lastCommit: {
            sha: 'ghi789',
            message: 'feat: implement rate limiting and caching',
            author: 'ChaseNoCap',
            date: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          },
        },
        {
          id: '4',
          name: 'ui-components',
          fullName: 'ChaseNoCap/ui-components',
          description: 'metaGOTHIC UI Components and Dashboard',
          url: 'https://github.com/ChaseNoCap/ui-components',
          isSubmodule: true,
          packageName: '@chasenocap/ui-components',
          version: '0.1.0',
          lastCommit: {
            sha: 'jkl012',
            message: 'feat: integrate GitHub API for real data',
            author: 'ChaseNoCap',
            date: new Date().toISOString(),
          },
        },
      ];
    });
  }

  /**
   * Fetch health metrics - simulates real workflow analysis
   */
  async fetchHealthMetrics(): Promise<HealthMetrics[]> {
    return this.withCaching('health-metrics', 120, async () => {
      await this.delay(500);
      this.requestCount++;

      const repos = await this.fetchRepositories();
      
      return repos.map((repo, index) => {
        // Simulate different health statuses
        const statusOptions: Array<'healthy' | 'warning' | 'critical'> = ['healthy', 'healthy', 'warning', 'critical'];
        const buildOptions: Array<'passing' | 'failing' | 'unknown'> = ['passing', 'passing', 'failing', 'unknown'];
        
        const workflows = this.generateMockWorkflows(repo.name, 5);
        const recentFailures = workflows.filter(w => w.conclusion === 'failure').length;
        
        return {
          repository: repo.name,
          status: recentFailures > 2 ? 'critical' : recentFailures > 0 ? 'warning' : 'healthy',
          lastUpdate: new Date().toISOString(),
          metrics: {
            buildStatus: buildOptions[index % buildOptions.length],
            testCoverage: 85 + Math.random() * 10,
            lastPublish: repo.lastCommit?.date,
            openIssues: Math.floor(Math.random() * 8),
            openPRs: Math.floor(Math.random() * 3),
            dependencyStatus: Math.random() > 0.8 ? 'outdated' : 'up-to-date',
          },
          workflows,
        };
      });
    });
  }

  /**
   * Trigger workflow - simulates GitHub Actions API
   */
  async triggerWorkflow(params: {
    repository: string;
    workflow: string;
    inputs?: Record<string, any>;
  }): Promise<void> {
    await this.delay(1000);
    console.log(`🚀 Triggered workflow: ${params.workflow} in ${params.repository}`);
    console.log('📋 Inputs:', params.inputs);
    
    // In real implementation, this would be:
    // await this.client.request(`POST /repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`, {...})
  }

  /**
   * Cancel workflow - simulates GitHub Actions API
   */
  async cancelWorkflow(params: {
    repository: string;
    runId: number;
  }): Promise<void> {
    await this.delay(800);
    console.log(`⏹️ Cancelled workflow run: ${params.runId} in ${params.repository}`);
    
    // In real implementation:
    // await this.client.request(`POST /repos/${owner}/${repo}/actions/runs/${runId}/cancel`)
  }

  /**
   * Publish package - simulates triggering publish workflow
   */
  async publishPackage(request: {
    repository: string;
    version: string;
    tag?: string;
    prerelease?: boolean;
  }): Promise<void> {
    await this.delay(1500);
    console.log(`📦 Publishing ${request.repository} v${request.version}`);
    console.log('🏷️ Tag:', request.tag || 'latest');
    console.log('🧪 Prerelease:', request.prerelease || false);
    
    // In real implementation, this triggers the publish.yml workflow
  }

  /**
   * Generate mock workflow runs
   */
  private generateMockWorkflows(repoName: string, count: number): WorkflowRun[] {
    const workflows = [];
    const workflowNames = ['CI', 'Tests', 'Build', 'Publish', 'Deploy'];
    const statuses: Array<'queued' | 'in_progress' | 'completed'> = ['completed', 'completed', 'in_progress'];
    const conclusions: Array<'success' | 'failure' | 'cancelled' | 'skipped'> = ['success', 'success', 'failure'];

    for (let i = 0; i < count; i++) {
      const createdAt = new Date(Date.now() - (i + 1) * 2 * 60 * 60 * 1000);
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      workflows.push({
        id: 1000 + i,
        name: workflowNames[i % workflowNames.length],
        status,
        conclusion: status === 'completed' ? conclusions[Math.floor(Math.random() * conclusions.length)] : undefined,
        createdAt: createdAt.toISOString(),
        updatedAt: new Date(createdAt.getTime() + 5 * 60 * 1000).toISOString(),
        headSha: `sha${i.toString().padStart(3, '0')}`,
        headBranch: 'main',
        event: 'push',
        repository: repoName,
      });
    }

    return workflows;
  }

  /**
   * Simple caching implementation
   */
  private async withCaching<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);

    if (cached && cached.expires > now) {
      console.log(`💾 Cache hit: ${key}`);
      return cached.data;
    }

    console.log(`🔄 Cache miss: ${key}, fetching...`);
    const result = await fn();
    
    this.cache.set(key, {
      data: result,
      expires: now + (ttlSeconds * 1000),
    });

    return result;
  }

  /**
   * Simulate network delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      cacheSize: this.cache.size,
      mode: 'mock',
    };
  }
}

// Export singleton instance
export const githubService = new MockGitHubService();