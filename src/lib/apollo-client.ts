

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
import { SseLink, ConnectionState, ErrorCategory } from './sse-link';

// Environment configuration - Use federated gateway endpoint
const GRAPHQL_ENDPOINT = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000/graphql';

// Create HTTP link for queries and mutations
const httpLink = createHttpLink({
  uri: GRAPHQL_ENDPOINT,
  // credentials: 'include', // Temporarily disabled due to CORS issues with Cosmo router
  fetchOptions: {
    // Set a 25-minute timeout to accommodate Claude CLI's 20-minute processing time
    // with some buffer for network latency
    timeout: 25 * 60 * 1000, // 25 minutes = 1,500,000 milliseconds
  },
});

// Create SSE link for subscriptions using our custom implementation
// For now, connect directly to Claude service for SSE until gateway SSE is configured
const SSE_ENDPOINT = import.meta.env.VITE_CLAUDE_SSE_URL || 'http://localhost:3002/graphql/stream';
const sseLink = new SseLink({
  url: SSE_ENDPOINT,
  // credentials: 'include', // Temporarily disabled due to CORS issues
  headers: {
    'Accept': 'text/event-stream',
  },
  retry: {
    attempts: 5,
    delay: 1000,
  },
  debug: {
    enabled: process.env.NODE_ENV === 'development',
    logLevel: 'debug',
  },
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

// SSE Connection monitoring link
const sseMonitoringLink = new ApolloLink((operation, forward) => {
  const definition = getMainDefinition(operation.query);
  const isSubscription = definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
  
  if (isSubscription) {
    // Add subscription tracking to context
    operation.setContext((context: any) => ({
      ...context,
      subscriptionId: Math.random().toString(36).substring(2),
      startTime: Date.now(),
    }));
  }
  
  return forward(operation);
});

// Request timing link (for performance monitoring)
const timingLink = new ApolloLink((operation, forward) => {
  const startTime = Date.now();
  const context = operation.getContext();
  
  // Log all GraphQL operations
  console.log(`[Apollo] Executing ${operation.operationName || 'unnamed'} operation:`, {
    operationType: operation.query.definitions[0].operation,
    variables: operation.variables,
    query: operation.query.loc?.source.body.substring(0, 200),
    subscriptionId: context.subscriptionId
  });
  
  return new Observable(observer => {
    const subscription = forward(operation).subscribe({
      next: (result) => {
        const duration = Date.now() - startTime;
        
        // Add timing and subscription info to extensions
        if (!result.extensions) {
          result.extensions = {};
        }
        result.extensions.timing = { duration };
        if (context.subscriptionId) {
          result.extensions.subscriptionId = context.subscriptionId;
        }
        
        console.log(`[Apollo] Completed ${operation.operationName || 'unnamed'} in ${duration}ms:`, {
          hasErrors: !!result.errors,
          dataKeys: result.data ? Object.keys(result.data) : [],
          errors: result.errors,
          subscriptionId: context.subscriptionId
        });
        
        // Log slow queries
        if (duration > 100) {
          console.warn(`Slow query detected: ${operation.operationName} took ${duration}ms`);
        }
        
        // Emit custom event for subscription monitoring
        if (context.subscriptionId) {
          window.dispatchEvent(new CustomEvent('apollo:subscription-data', {
            detail: {
              subscriptionId: context.subscriptionId,
              operationName: operation.operationName,
              duration,
              hasErrors: !!result.errors
            }
          }));
        }
        
        observer.next(result);
      },
      error: (error) => {
        console.error(`[Apollo] Error in ${operation.operationName || 'unnamed'}:`, error);
        
        // Emit error event for subscriptions
        if (context.subscriptionId) {
          window.dispatchEvent(new CustomEvent('apollo:subscription-error', {
            detail: {
              subscriptionId: context.subscriptionId,
              operationName: operation.operationName,
              error: error.message,
              category: (error as any).category
            }
          }));
        }
        
        observer.error(error);
      },
      complete: () => {
        // Emit complete event for subscriptions
        if (context.subscriptionId) {
          window.dispatchEvent(new CustomEvent('apollo:subscription-complete', {
            detail: {
              subscriptionId: context.subscriptionId,
              operationName: operation.operationName
            }
          }));
        }
        
        observer.complete();
      },
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
  sseMonitoringLink,  // Track subscription lifecycle
  timingLink,         // Performance monitoring
  errorLink,          // Error handling
  retryLink,          // Retry logic
  splitLink           // Route to HTTP or SSE
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
          health {
            healthy
            service
            details
          }
        }
      `,
      fetchPolicy: 'network-only',
    });
    
    // Check if the health query returned data
    const healthData = result.data?.health;
    const healthy = healthData?.healthy || false;
    
    // Log which service responded (for debugging)
    if (healthData?.service) {
      console.log(`Health check responded from: ${healthData.service}`);
    }
    
    return healthy;
  } catch (error) {
    console.error('GraphQL health check failed:', error);
    return false;
  }
};

// Export types for use in components
export type { ApolloClient } from '@apollo/client/core';

// Export SSE link instance for debugging and monitoring
export { sseLink, ConnectionState, ErrorCategory };

// Helper function to get SSE connection status
export const getSseConnectionStatus = () => {
  return sseLink.getActiveSubscriptions();
};

// Apollo Client extension for SSE monitoring
export const apolloClientWithSse = Object.assign(apolloClient, {
  sseLink,
  getSseConnectionStatus,
  // Method to check specific subscription health
  getSubscriptionHealth: (operationName: string) => {
    const subscriptions = sseLink.getActiveSubscriptions();
    return subscriptions.find(sub => sub.operationName === operationName);
  },
  // Method to dispose all SSE connections
  disposeSseConnections: () => {
    sseLink.dispose();
  }
});