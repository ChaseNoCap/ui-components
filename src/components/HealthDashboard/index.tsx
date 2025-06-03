// Export enhanced dashboard as default (includes GitHub data + pipeline control)
export { EnhancedDashboard as HealthDashboard } from './EnhancedDashboard';

// Also export individual versions
export { HealthDashboardGraphQL } from './HealthDashboardGraphQL';
export { CombinedHealthDashboard } from './CombinedHealthDashboard';
export { EnhancedDashboard } from './EnhancedDashboard';

// Re-export components used by dashboards
export { RepositoryCard } from './RepositoryCard';
export { MetricsOverview } from './MetricsOverview';
export { WorkflowList } from './WorkflowList';