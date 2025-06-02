# GraphQL Migration Guide

## Overview

The Meta GOTHIC UI Components package now supports both REST and GraphQL APIs, with the ability to switch between them dynamically.

## Quick Start

### 1. Start All Services

```bash
# From ui-components directory
npm run dev:full

# This starts:
# - Vite dev server (port 3001)
# - Git REST server (port 3003)
# - Claude REST server
# - GraphQL services:
#   - repo-agent-service (port 3004)
#   - claude-service (port 3002)
#   - federation gateway (port 3000)
```

### 2. Configure API Mode

Set the API mode in your `.env.local`:

```env
# Use GraphQL (recommended)
VITE_API_MODE=graphql
VITE_USE_GRAPHQL=true

# Or use REST (legacy)
VITE_API_MODE=rest
VITE_USE_GRAPHQL=false
```

### 3. Switch API Mode at Runtime

The UI includes an API mode switcher component that allows switching between REST and GraphQL without editing config files.

## Architecture

### GraphQL Stack

1. **Apollo Client**: Handles GraphQL queries, mutations, and subscriptions
2. **Federation Gateway**: Unifies multiple GraphQL services (port 3000)
3. **Service Architecture**:
   - `repo-agent-service`: Git operations
   - `claude-service`: AI operations with Claude
   - `meta-gothic-app`: Federation gateway

### Key Components

#### Apollo Client Setup
```typescript
// src/lib/apollo-client.ts
- Configured with HTTP and WebSocket links
- Automatic reconnection for subscriptions
- Comprehensive error handling
- Cache policies for optimal performance
```

#### GraphQL Provider
```typescript
// src/providers/GraphQLProvider.tsx
- Wraps the app with Apollo Provider
- Health checks for gateway availability
- Graceful fallback UI when services are down
```

#### API Adapter
```typescript
// src/services/api-adapter.ts
- Abstracts REST vs GraphQL implementation
- Allows runtime switching between APIs
- Maintains consistent interface for components
```

## GraphQL Queries & Mutations

### Git Operations

```graphql
# Get git status
query GetGitStatus($path: String!) {
  gitStatus(path: $path) {
    branch
    files {
      path
      status
      staged
    }
  }
}

# Commit changes
mutation CommitChanges($input: CommitInput!) {
  commitChanges(input: $input) {
    success
    commitHash
    error
  }
}
```

### Claude Operations

```graphql
# Generate commit messages
mutation GenerateCommitMessages($input: BatchCommitMessageInput!) {
  generateCommitMessages(input: $input) {
    messages {
      repository
      message
      confidence
    }
  }
}

# Watch Claude output (subscription)
subscription WatchClaudeOutput($sessionId: ID!) {
  commandOutput(sessionId: $sessionId) {
    type
    content
    timestamp
  }
}
```

## Migration Progress

### ✅ Completed
- Apollo Client setup with WebSocket support
- GraphQL Provider with health checks
- API adapter for REST/GraphQL switching
- Query and mutation definitions
- Subscription support
- Environment configuration

### 🚧 In Progress
- Component migration to use GraphQL hooks
- Type generation with GraphQL Code Generator
- Performance optimization with DataLoader

### 📋 TODO
- Complete migration of all components
- Add GraphQL caching strategies
- Implement optimistic updates
- Add retry logic for failed mutations

## Using GraphQL in Components

### Example: Using GraphQL Hook

```typescript
import { useScanAllRepositories } from '../hooks/useGraphQL';

export const MyComponent = () => {
  const { data, loading, error, refetch } = useScanAllRepositories();
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <div>
      {data.scanAllRepositories.map(repo => (
        <div key={repo.path}>{repo.name}</div>
      ))}
    </div>
  );
};
```

### Example: Using API Adapter

```typescript
import { api } from '../services/api-adapter';

// Works with both REST and GraphQL
const status = await api.git.getStatus('/path/to/repo');
const result = await api.git.commitChanges(path, message);
```

## Type Generation

Generate TypeScript types from GraphQL schema:

```bash
# One-time generation
npm run codegen

# Watch mode for development
npm run codegen:watch
```

## Benefits of GraphQL

1. **Single Request**: Fetch exactly what you need in one request
2. **Real-time Updates**: Subscriptions for live data
3. **Type Safety**: Auto-generated TypeScript types
4. **Federation**: Unified API across multiple services
5. **Performance**: Parallel execution and intelligent caching

## Troubleshooting

### GraphQL Gateway Not Available
- Ensure all services are running: `npm run dev:full`
- Check service health: http://localhost:3000/health
- Verify ports are not in use

### Type Generation Fails
- Ensure GraphQL services are running
- Check network connectivity to localhost:3000
- Verify schema is valid

### Switching API Modes
- Use the API mode switcher in the UI
- Or set `VITE_API_MODE` in `.env.local`
- Page will reload when switching modes