import { describe, it, expect } from 'vitest';
import { fetchRepositories, fetchHealthMetrics } from './api';

describe('API Service', () => {
  describe('fetchRepositories', () => {
    it('returns mock repository data', async () => {
      const repos = await fetchRepositories();
      
      expect(repos).toBeDefined();
      expect(Array.isArray(repos)).toBe(true);
      expect(repos.length).toBe(8); // We have 8 metaGOTHIC packages
      
      // Check structure of first repo
      const firstRepo = repos[0];
      expect(firstRepo).toHaveProperty('id');
      expect(firstRepo).toHaveProperty('name');
      expect(firstRepo).toHaveProperty('url');
      expect(firstRepo).toHaveProperty('isSubmodule');
    });

    it('includes all metaGOTHIC packages', async () => {
      const repos = await fetchRepositories();
      const packageNames = repos.map(r => r.name);
      
      expect(packageNames).toContain('claude-client');
      expect(packageNames).toContain('prompt-toolkit');
      expect(packageNames).toContain('sdlc-config');
      expect(packageNames).toContain('ui-components');
    });
  });

  describe('fetchHealthMetrics', () => {
    it('returns health metrics for all repositories', async () => {
      const metrics = await fetchHealthMetrics();
      
      expect(metrics).toBeDefined();
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBe(8);
      
      // Check structure
      const firstMetric = metrics[0];
      expect(firstMetric).toHaveProperty('repository');
      expect(firstMetric).toHaveProperty('status');
      expect(firstMetric).toHaveProperty('metrics');
      expect(firstMetric.metrics).toHaveProperty('buildStatus');
    });

    it('generates realistic mock data', async () => {
      const metrics = await fetchHealthMetrics();
      
      metrics.forEach(metric => {
        expect(['healthy', 'warning', 'critical']).toContain(metric.status);
        expect(['passing', 'failing']).toContain(metric.metrics.buildStatus);
        expect(metric.metrics.testCoverage).toBeGreaterThanOrEqual(60);
        expect(metric.metrics.testCoverage).toBeLessThanOrEqual(100);
      });
    });
  });
});