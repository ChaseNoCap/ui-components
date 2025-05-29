export interface Repository {
  id: string;
  name: string;
  fullName: string;
  description?: string;
  url: string;
  isSubmodule: boolean;
  packageName?: string;
  version?: string;
  lastCommit?: {
    sha: string;
    message: string;
    author: string;
    date: string;
  };
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped';
  createdAt: string;
  updatedAt: string;
  headSha: string;
  headBranch: string;
  event: string;
  repository: string;
}

export interface HealthMetrics {
  repository: string;
  status: 'healthy' | 'warning' | 'critical';
  lastUpdate: string;
  metrics: {
    buildStatus: 'passing' | 'failing' | 'unknown';
    testCoverage?: number;
    lastPublish?: string;
    openIssues?: number;
    openPRs?: number;
    dependencyStatus?: 'up-to-date' | 'outdated' | 'security-issues';
  };
  workflows: WorkflowRun[];
}

export interface PipelineAction {
  type: 'trigger' | 'cancel' | 'retry';
  workflowId: string;
  repository: string;
  inputs?: Record<string, any>;
}

export interface PublishRequest {
  repository: string;
  version: string;
  tag?: string;
  prerelease?: boolean;
}