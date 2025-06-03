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
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';

// Environment configuration
const GRAPHQL_ENDPOINT = import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:3000/graphql';
const WS_ENDPOINT = import.meta.env.VITE_WS_ENDPOINT || 'ws://localhost:3000/graphql';

// Create HTTP link for queries and mutations
const httpLink = createHttpLink({
  uri: GRAPHQL_ENDPOINT,
  credentials: 'include', // Include cookies for auth
});

// Create WebSocket link for subscriptions
const wsLink = new GraphQLWsLink(
  createClient({
    url: WS_ENDPOINT,
    connectionParams: async () => ({
      // Add auth token if available
      authToken: localStorage.getItem('authToken'),
    }),
    shouldRetry: () => true,
    retryAttempts: 5,
    connectionAckWaitTimeout: 5000,
  })
);

// Retry link for network failures
const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: 5000,
    jitter: true
  },
  attempts: {
    max: 5,
    retryIf: (error, _operation) => {
      // Retry on network errors
      return !!error && error.networkError !== null;
    }
  }
});

// Error handling link
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
        extensions
      );
      
      // Handle specific error codes
      if (extensions?.code === 'UNAUTHENTICATED') {
        // Redirect to login or refresh token
        window.location.href = '/login';
      }
    });
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
    
    // Handle offline scenarios
    if (!navigator.onLine) {
      console.log('App is offline, will retry when online');
    }
  }
});

// Request timing link (for performance monitoring)
const timingLink = new ApolloLink((operation, forward) => {
  const startTime = Date.now();
  
  return new Observable(observer => {
    const subscription = forward(operation).subscribe({
      next: (result) => {
        const duration = Date.now() - startTime;
        
        // Add timing to extensions
        if (result.extensions) {
          result.extensions.timing = { duration };
        }
        
        // Log slow queries
        if (duration > 100) {
          console.warn(`Slow query detected: ${operation.operationName} took ${duration}ms`);
        }
        
        observer.next(result);
      },
      error: observer.error.bind(observer),
      complete: observer.complete.bind(observer),
    });
    
    return () => subscription.unsubscribe();
  });
});

// Split traffic between WebSocket and HTTP
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
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
      keyFields: ['owner', 'name'],
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
      keyFields: ['path'],
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

// Health check function
export const checkGraphQLHealth = async (): Promise<boolean> => {
  try {
    const result = await apolloClient.query({
      query: gql`
        query HealthCheck {
          health {
            healthy
          }
        }
      `,
      fetchPolicy: 'network-only',
    });
    
    return result.data?.health?.healthy || false;
  } catch (error) {
    console.error('GraphQL health check failed:', error);
    return false;
  }
};

// Export types for use in components
export type { ApolloClient } from '@apollo/client/core';