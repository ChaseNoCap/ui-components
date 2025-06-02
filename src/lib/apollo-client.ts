import { ApolloClient, InMemoryCache, split, ApolloLink } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { onError } from '@apollo/client/link/error';
import { createHttpLink } from '@apollo/client/link/http';

// GraphQL Gateway URL
const GRAPHQL_HTTP_URL = import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:3000/graphql';
const GRAPHQL_WS_URL = import.meta.env.VITE_GRAPHQL_WS_URL || 'ws://localhost:3000/graphql';

// Direct service URLs for fallback
export const CLAUDE_SERVICE_URL = 'http://localhost:3002/graphql';
export const REPO_SERVICE_URL = 'http://localhost:3004/graphql';

// Create HTTP link for queries and mutations
const httpLink = createHttpLink({
  uri: GRAPHQL_HTTP_URL,
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create WebSocket link for subscriptions
const wsLink = new GraphQLWsLink(
  createClient({
    url: GRAPHQL_WS_URL,
    connectionParams: {
      // Add any auth tokens or connection params here
      timestamp: new Date().toISOString(),
    },
    reconnect: true,
    retryAttempts: 5,
    shouldRetry: () => true,
    on: {
      connected: () => console.log('WebSocket connected'),
      closed: () => console.log('WebSocket closed'),
      error: (error) => console.error('WebSocket error:', error),
    },
  })
);

// Error handling link
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  console.log('🔍 GraphQL Operation:', operation.operationName, operation.variables);
  
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `GraphQL error: Message: ${message}, Location: ${locations}, Path: ${path}`,
        extensions
      );
    });
  }

  if (networkError) {
    console.error(`Network error: ${networkError}`);
    console.error('Network error details:', {
      message: networkError.message,
      name: networkError.name,
      response: (networkError as any).response,
      statusCode: (networkError as any).statusCode
    });
    
    // Retry on network errors
    if (networkError.message.includes('Failed to fetch')) {
      return forward(operation);
    }
  }
});

// Use split to route operations to the correct link
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

// Combine error handling with split link
const link = ApolloLink.from([errorLink, splitLink]);

// Create Apollo Client instance
export const apolloClient = new ApolloClient({
  link,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // Cache policies for specific queries
          gitStatus: {
            keyArgs: ['path'],
          },
          scanAllRepositories: {
            keyArgs: false, // Always fetch fresh data
          },
          scanAllDetailed: {
            keyArgs: false, // Always fetch fresh data
            merge: false, // Replace instead of merging
          },
          sessions: {
            merge: false, // Replace sessions array instead of merging
          },
        },
      },
      GitStatus: {
        keyFields: ['branch'],
      },
      ClaudeSession: {
        keyFields: ['id'],
      },
      RepositoryScan: {
        keyFields: ['path'],
      },
      DetailedRepository: {
        keyFields: ['path'],
      },
      DetailedScanReport: {
        keyFields: false, // No key fields, always replace
      },
      FileStatus: {
        keyFields: ['path'],
      },
      ScanStatistics: {
        keyFields: false,
      },
      ScanMetadata: {
        keyFields: false,
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});

// Helper to check if GraphQL gateway is available
export async function checkGraphQLHealth(): Promise<boolean> {
  try {
    const response = await fetch(GRAPHQL_HTTP_URL.replace('/graphql', '/health'));
    return response.ok;
  } catch {
    return false;
  }
}

// Create a separate client for Claude service (temporary workaround)
export const claudeClient = new ApolloClient({
  link: createHttpLink({
    uri: CLAUDE_SERVICE_URL,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    fetchOptions: {
      mode: 'cors',
    },
  }),
  cache: new InMemoryCache(),
  defaultOptions: {
    query: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});