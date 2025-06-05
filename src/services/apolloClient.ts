import { ApolloClient, InMemoryCache, createHttpLink, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';

// HTTP link for queries and mutations - Use federated gateway
const httpLink = createHttpLink({
  uri: import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3000/graphql',
});

// WebSocket link for subscriptions using graphql-ws
const wsLink = new GraphQLWsLink(
  createClient({
    url: import.meta.env.VITE_GATEWAY_WS_URL || 'ws://localhost:3000/graphql',
    connectionParams: {
      // Add any auth tokens here if needed
    },
    // Reconnection options
    retryAttempts: 5,
    shouldRetry: () => true,
    keepAlive: 10_000, // 10 second heartbeat
    // Connection lifecycle callbacks
    on: {
      connected: () => console.log('WebSocket connected'),
      closed: () => console.log('WebSocket closed'),
      error: (error) => console.error('WebSocket error:', error),
      ping: () => console.debug('WebSocket ping'),
      pong: () => console.debug('WebSocket pong'),
    },
  })
);

// Split links based on operation type
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

// Create Apollo Client
export const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // Define any cache policies here
          agentRuns: {
            merge(existing = [], incoming) {
              return incoming;
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
    query: {
      fetchPolicy: 'network-only',
    },
  },
});