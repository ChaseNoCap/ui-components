// Export services - keep REST as primary to avoid breaking existing code
export { githubServiceGraphQL as githubService } from './githubServiceGraphQL';
export { gitServiceGraphQL as gitService } from './gitServiceGraphQL';
// Export the actual REST service, not the GraphQL one
export { changeReviewService } from './changeReviewService';
export { claudeServiceGraphQL as claudeService } from './claudeServiceGraphQL';

// Export Apollo client
export * from './apolloClient';

// GraphQL-specific exports
export * from './graphqlChangeReviewService';
export * from './graphqlParallelChangeReviewService';
// Also export the GraphQL version of changeReviewService with explicit name
export { changeReviewServiceGraphQL } from './changeReviewServiceGraphQL';

// Session management (still needed)
export * from './claudeSessionManager';
export * from './settingsService';

// Legacy exports (deprecated - remove after migration verification)
// export * from './api';
// export * from './githubService';
// export * from './githubServiceMock';
// export * from './dataFetcher';
// export * from './toolsService';
// export * from './toolsDataFetcher';
// export * from './changeReviewService';