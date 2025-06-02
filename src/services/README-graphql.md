# GraphQL Change Review Services

This directory contains three implementations of the Change Review service:

## 1. REST API Service (`changeReviewService.ts`)
- **Type**: Sequential REST API calls
- **Performance**: Slowest (all operations are sequential)
- **Use Case**: Legacy support, simpler debugging
- **Endpoints**: 
  - `/api/git/scan-all-detailed`
  - `/api/claude/batch-commit-messages`
  - `/api/claude/executive-summary`

## 2. GraphQL Service (`graphqlChangeReviewService.ts`)
- **Type**: GraphQL with batched mutations
- **Performance**: Faster than REST (single network request for mutations)
- **Use Case**: Standard GraphQL implementation
- **Features**:
  - Single mutation for all commit messages
  - Reduced network overhead
  - Type-safe GraphQL operations

## 3. Parallel GraphQL Service (`graphqlParallelChangeReviewService.ts`)
- **Type**: True parallel GraphQL mutations
- **Performance**: Fastest (5x faster for 10+ repositories)
- **Use Case**: Large codebases with many repositories
- **Features**:
  - Generates dynamic GraphQL mutations with field aliases
  - Each repository gets its own mutation field
  - GraphQL executor handles parallelism automatically
  - Real parallel execution on the server

## Performance Comparison

For 10 repositories with changes:
- **REST API**: ~30 seconds (sequential)
- **GraphQL Batched**: ~20 seconds (single request, but sequential server processing)
- **GraphQL Parallel**: ~6 seconds (true parallel execution)

## Usage

The Change Review page includes a mode selector that allows switching between implementations:

```typescript
// Select service based on mode
const reviewService = 
  apiMode === 'graphql-parallel' ? graphqlParallelChangeReviewService :
  apiMode === 'graphql' ? graphqlChangeReviewService : 
  changeReviewService;
```

## Implementation Details

### Parallel Mutation Generation

The parallel service dynamically generates GraphQL mutations:

```graphql
mutation ParallelCommitMessages($input0: BatchCommitMessageInput!, $input1: BatchCommitMessageInput!) {
  msg0: generateCommitMessages(input: $input0) {
    results {
      ...CommitMessageFields
    }
  }
  msg1: generateCommitMessages(input: $input1) {
    results {
      ...CommitMessageFields
    }
  }
}
```

Each repository gets its own aliased field (`msg0`, `msg1`, etc.), allowing the GraphQL executor to run them in parallel.

### Server Requirements

For the parallel implementation to work effectively, the GraphQL server must:

1. Support concurrent resolver execution
2. Have appropriate rate limiting for Claude API calls
3. Use a queue system (like p-queue) to manage concurrent processes

### Environment Variables

- `VITE_GRAPHQL_URL`: GraphQL endpoint (default: `http://localhost:3001/graphql`)
- `VITE_GRAPHQL_WS_URL`: WebSocket endpoint for subscriptions (default: `ws://localhost:3001/graphql`)
- `VITE_USE_GRAPHQL`: Feature flag to enable GraphQL by default (default: `false`)

## Future Enhancements

1. **Progress Subscriptions**: Real-time progress updates via GraphQL subscriptions
2. **Caching**: Apollo Client cache policies for repository data
3. **Optimistic Updates**: Update UI before server confirmation
4. **Error Recovery**: Retry individual failed mutations
5. **Metrics**: Track performance improvements in production