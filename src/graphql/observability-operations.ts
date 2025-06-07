import { gql } from '@apollo/client';

// Simplified queries for now - will be expanded when backend is ready
export const PERFORMANCE_METRICS_QUERY = gql`
  query GetPerformanceMetrics($operation: String, $lastMinutes: Int) {
    performanceMetrics(operation: $operation, lastMinutes: $lastMinutes) {
      operations {
        operation
        count
        avgDuration
        maxDuration
        errors
      }
      timeRange {
        start
        end
      }
      totalOperations
    }
  }
`;

export const SESSION_ANALYTICS_QUERY = gql`
  query GetSessionAnalytics($startDate: String, $endDate: String) {
    sessionAnalytics(startDate: $startDate, endDate: $endDate) {
      totalSessions
      totalTokensUsed
      totalCost
      avgTokensPerSession
      avgSessionDuration
      sessionsByModel {
        model
        count
        tokensUsed
      }
    }
  }
`;

// Mock subscription for active operations
export const ACTIVE_OPERATIONS_SUBSCRIPTION = gql`
  subscription OnCommandOutput($sessionId: ID!) {
    commandOutput(sessionId: $sessionId) {
      sessionId
      output
      timestamp
    }
  }
`;