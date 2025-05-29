import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchRepositories, fetchHealthMetrics, triggerWorkflow, cancelWorkflow, publishPackage } from './api';

describe('GitHub API Integration', () => {
  beforeEach(() => {
    // Clear any existing console logs
    vi.clearAllMocks();
  });

  describe('fetchRepositories', () => {
    it('should fetch repository data successfully', async () => {
      const repositories = await fetchRepositories();
      
      expect(repositories).toBeDefined();
      expect(Array.isArray(repositories)).toBe(true);
      expect(repositories.length).toBeGreaterThan(0);
      
      // Check repository structure
      const repo = repositories[0];
      expect(repo).toHaveProperty('id');
      expect(repo).toHaveProperty('name');
      expect(repo).toHaveProperty('fullName');
      expect(repo).toHaveProperty('url');
      expect(repo).toHaveProperty('isSubmodule');
      
      // Verify it includes metaGOTHIC packages
      const packageNames = repositories.map(r => r.name);
      expect(packageNames).toContain('claude-client');
      expect(packageNames).toContain('github-graphql-client');
    });

    it('should include commit information', async () => {
      const repositories = await fetchRepositories();
      const repoWithCommit = repositories.find(r => r.lastCommit);
      
      if (repoWithCommit) {
        expect(repoWithCommit.lastCommit).toHaveProperty('sha');
        expect(repoWithCommit.lastCommit).toHaveProperty('message');
        expect(repoWithCommit.lastCommit).toHaveProperty('author');
        expect(repoWithCommit.lastCommit).toHaveProperty('date');
      }
    });
  });

  describe('fetchHealthMetrics', () => {
    it('should fetch health metrics successfully', async () => {
      const healthMetrics = await fetchHealthMetrics();
      
      expect(healthMetrics).toBeDefined();
      expect(Array.isArray(healthMetrics)).toBe(true);
      expect(healthMetrics.length).toBeGreaterThan(0);
      
      // Check health metrics structure
      const metric = healthMetrics[0];
      expect(metric).toHaveProperty('repository');
      expect(metric).toHaveProperty('status');
      expect(metric).toHaveProperty('lastUpdate');
      expect(metric).toHaveProperty('metrics');
      expect(metric).toHaveProperty('workflows');
      
      // Validate status values
      expect(['healthy', 'warning', 'critical']).toContain(metric.status);
    });

    it('should include workflow information', async () => {
      const healthMetrics = await fetchHealthMetrics();
      const metricWithWorkflows = healthMetrics.find(m => m.workflows.length > 0);
      
      if (metricWithWorkflows) {
        const workflow = metricWithWorkflows.workflows[0];
        expect(workflow).toHaveProperty('id');
        expect(workflow).toHaveProperty('name');
        expect(workflow).toHaveProperty('status');
        expect(workflow).toHaveProperty('repository');
      }
    });

    it('should provide metrics data', async () => {
      const healthMetrics = await fetchHealthMetrics();
      const metric = healthMetrics[0];
      
      expect(metric.metrics).toHaveProperty('buildStatus');
      expect(['passing', 'failing', 'unknown']).toContain(metric.metrics.buildStatus);
      
      if (metric.metrics.testCoverage !== undefined) {
        expect(typeof metric.metrics.testCoverage).toBe('number');
        expect(metric.metrics.testCoverage).toBeGreaterThanOrEqual(0);
        expect(metric.metrics.testCoverage).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Pipeline Control', () => {
    it('should trigger workflow successfully', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      await triggerWorkflow({
        repository: 'ChaseNoCap/test-repo',
        workflow: 'ci.yml',
        inputs: { version: '1.0.0' }
      });
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should cancel workflow successfully', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      await cancelWorkflow({
        repository: 'ChaseNoCap/test-repo',
        runId: 12345
      });
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should publish package successfully', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      await publishPackage({
        repository: 'ChaseNoCap/test-package',
        version: '1.0.0',
        tag: 'latest',
        prerelease: false
      });
      
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});