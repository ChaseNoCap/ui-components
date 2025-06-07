import { 
  ApolloClient, 
  InMemoryCache, 
  createHttpLink,
  split,
  ApolloLink,
  Observable,
  gql
} from '@apollo/client/core';
import { getMainDefinition } from '@apollo/client/utilities';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';
import { YogaSSELink } from './sse-link';

// Environment configuration - Use federated gateway endpoint
const GRAPHQL_ENDPOINT = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000/graphql';
const WS_ENDPOINT = import.meta.env.VITE_GATEWAY_WS_URL || 'ws://localhost:4000/graphql';

// Create HTTP link for queries and mutations
const httpLink = createHttpLink({
  uri: GRAPHQL_ENDPOINT,
  // Remove credentials mode to avoid CORS issues with federation gateway
  // Authentication is handled at the gateway level
});

// Create SSE link for subscriptions with GraphQL Yoga
const sseLink = new YogaSSELink({
  uri: GRAPHQL_ENDPOINT,
});

// Enhanced retry link with federation awareness
const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: 5000,
    jitter: true
  },
  attempts: {
    max: 5,
    retryIf: (error, operation) => {
      // Don't retry on GraphQL validation errors (federation type mismatches)
      if (error?.graphQLErrors?.some(e => e.extensions?.code === 'GRAPHQL_VALIDATION_FAILED')) {
        return false;
      }
      
      // Don't retry on authentication errors
      if (error?.graphQLErrors?.some(e => e.extensions?.code === 'UNAUTHENTICATED')) {
        return false;
      }
      
      // Retry on network errors
      if (error?.networkError) {
        // Special handling for timeout errors - limit retries
        if (error.networkError.message?.includes('timeout')) {
          const attempt = (operation as any).attempt || 0;
          return attempt < 2; // Only retry timeouts twice
        }
        return true;
      }
      
      // Retry on service unavailable errors
      if (error?.graphQLErrors?.some(e => e.extensions?.code === 'SERVICE_UNAVAILABLE')) {
        return true;
      }
      
      return false;
    }
  }
});

// Error handling link with enhanced federation support
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      // Enhanced error logging with federation context
      const errorContext = {
        operation: operation.operationName,
        variables: operation.variables,
        extensions
      };
      
      // Handle federation-specific errors
      if (extensions?.code === 'GRAPHQL_VALIDATION_FAILED') {
        // Provide helpful messages for common federation type mismatches
        if (message.includes('Unknown type')) {
          const typeMatch = message.match(/Unknown type "([^"]+)"/);
          const suggestedTypes = message.match(/Did you mean "([^"]+)"/g);
          
          console.error(
            `[Federation Type Error]: Type '${typeMatch?.[1]}' not found in schema.`,
            suggestedTypes ? `Suggested types: ${suggestedTypes.join(', ')}` : '',
            errorContext
          );
          
          // Emit custom event for UI to handle
          window.dispatchEvent(new CustomEvent('graphql:federation-error', {
            detail: {
              type: 'TYPE_MISMATCH',
              invalidType: typeMatch?.[1],
              suggestions: suggestedTypes,
              operation: operation.operationName
            }
          }));
        }
      } else if (extensions?.code === 'UNAUTHENTICATED') {
        // Redirect to login or refresh token
        window.location.href = '/login';
      } else if (extensions?.code === 'SERVICE_UNAVAILABLE') {
        console.error(
          `[Service Error]: GraphQL service unavailable for operation '${operation.operationName}'`,
          errorContext
        );
        
        // Emit event for UI to show service status
        window.dispatchEvent(new CustomEvent('graphql:service-error', {
          detail: {
            service: extensions.service,
            operation: operation.operationName
          }
        }));
      } else {
        console.error(
          `[GraphQL error]: ${message}`,
          { locations, path, ...errorContext }
        );
      }
    });
  }

  if (networkError) {
    const isTimeout = networkError.message?.includes('timeout');
    const isConnectionRefused = networkError.message?.includes('ECONNREFUSED');
    
    if (isTimeout) {
      console.error(`[Network Timeout]: Operation '${operation.operationName}' timed out`);
      
      // Emit timeout event
      window.dispatchEvent(new CustomEvent('graphql:timeout', {
        detail: { operation: operation.operationName }
      }));
    } else if (isConnectionRefused) {
      console.error(`[Connection Error]: Cannot connect to GraphQL server at ${GRAPHQL_ENDPOINT}`);
      
      // Emit connection error event
      window.dispatchEvent(new CustomEvent('graphql:connection-error', {
        detail: { endpoint: GRAPHQL_ENDPOINT }
      }));
    } else if (!navigator.onLine) {
      console.log('App is offline, will retry when online');
      
      // Emit offline event
      window.dispatchEvent(new CustomEvent('graphql:offline'));
    } else {
      console.error(`[Network error]: ${networkError}`, {
        operation: operation.operationName,
        variables: operation.variables,
        query: operation.query.loc?.source.body.substring(0, 200)
      });
    }
  }
});

// Request timing link (for performance monitoring)
const timingLink = new ApolloLink((operation, forward) => {
  const startTime = Date.now();
  
  // Log all GraphQL operations
  console.log(`[Apollo] Executing ${operation.operationName || 'unnamed'} operation:`, {
    operationType: operation.query.definitions[0].operation,
    variables: operation.variables,
    query: operation.query.loc?.source.body.substring(0, 200)
  });
  
  return new Observable(observer => {
    const subscription = forward(operation).subscribe({
      next: (result) => {
        const duration = Date.now() - startTime;
        
        // Add timing to extensions
        if (result.extensions) {
          result.extensions.timing = { duration };
        }
        
        console.log(`[Apollo] Completed ${operation.operationName || 'unnamed'} in ${duration}ms:`, {
          hasErrors: !!result.errors,
          dataKeys: result.data ? Object.keys(result.data) : [],
          errors: result.errors
        });
        
        // Log slow queries
        if (duration > 100) {
          console.warn(`Slow query detected: ${operation.operationName} took ${duration}ms`);
        }
        
        observer.next(result);
      },
      error: (error) => {
        console.error(`[Apollo] Error in ${operation.operationName || 'unnamed'}:`, error);
        observer.error(error);
      },
      complete: observer.complete.bind(observer),
    });
    
    return () => subscription.unsubscribe();
  });
});

// Split traffic between HTTP (queries/mutations) and SSE (subscriptions)
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  sseLink,
  httpLink
);

// Combine all links
const link = ApolloLink.from([
  timingLink,
  errorLink,
  retryLink,
  splitLink
]);

// Configure cache with type policies
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        // Cache repository queries by path
        gitStatus: {
          keyArgs: ['path'],
        },
        repositoryDetails: {
          keyArgs: ['path'],
        },
      }
    },
    Repository: {
      keyFields: ['path'], // Use path as unique identifier for local repositories
    },
    ClaudeSession: {
      keyFields: ['id'],
    },
    AgentRun: {
      keyFields: ['id'],
      fields: {
        // Merge arrays for progress updates
        logs: {
          merge(existing = [], incoming) {
            return [...existing, ...incoming];
          }
        }
      }
    },
    GitStatus: {
      keyFields: false, // GitStatus is not an entity, it's embedded in Repository
    },
    SystemHealth: {
      keyFields: [], // Singleton
      merge: true,
    }
  },
  possibleTypes: {
    // Add possible types for interfaces/unions if needed
  }
});

// Create Apollo Client instance
export const apolloClient = new ApolloClient({
  link,
  cache,
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'cache-first',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
  connectToDevTools: process.env.NODE_ENV === 'development',
});

// Helper to reset store (useful for logout)
export const resetApolloStore = async () => {
  await apolloClient.clearStore();
};

// Helper to refetch all active queries
export const refetchAllQueries = async () => {
  await apolloClient.refetchQueries({
    include: 'active',
  });
};

// Health check function - uses federated health queries
export const checkGraphQLHealth = async (): Promise<boolean> => {
  try {
    const result = await apolloClient.query({
      query: gql`
        query HealthCheck {
          claudeHealth {
            healthy
            claudeAvailable
          }
          repoAgentHealth {
            status
          }
        }
      `,
      fetchPolicy: 'network-only',
    });
    
    const claudeHealthy = result.data?.claudeHealth?.healthy || false;
    const repoHealthy = result.data?.repoAgentHealth?.status === 'healthy' || false;
    
    return claudeHealthy && repoHealthy;
  } catch (error) {
    console.error('GraphQL health check failed:', error);
    return false;
  }
};

// Export types for use in components
export type { ApolloClient } from '@apollo/client/core';