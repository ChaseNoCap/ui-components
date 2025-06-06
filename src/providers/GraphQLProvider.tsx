import React, { useEffect, useState } from 'react';
import { ApolloProvider } from '@apollo/client';
import { apolloClient, checkGraphQLHealth } from '../lib/apollo-client';
import { ErrorMessage } from '../components/ErrorDisplay/ErrorMessage';
import { Spinner } from '../components/LoadingStates/Spinner';

interface GraphQLProviderProps {
  children: React.ReactNode;
}

export function GraphQLProvider({ children }: GraphQLProviderProps) {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const checkHealth = async () => {
      const healthy = await checkGraphQLHealth();
      setIsHealthy(healthy);
      
      if (!healthy && retryCount < 3) {
        // Retry after 2 seconds
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 2000);
      }
    };

    checkHealth();
  }, [retryCount]);

  if (isHealthy === null) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Connecting to GraphQL Gateway...
          </p>
        </div>
      </div>
    );
  }

  if (!isHealthy) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <ErrorMessage
            title="GraphQL Gateway Unavailable"
            message="Unable to connect to the GraphQL gateway. Please ensure all services are running."
            showDetails={true}
            onRetry={() => setRetryCount(prev => prev + 1)}
          />
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-4 rounded">
            <p className="font-semibold">To start the GraphQL services, run:</p>
            <pre className="mt-2 p-2 bg-gray-200 dark:bg-gray-700 rounded overflow-x-auto">
              npm run dev:graphql
            </pre>
            <p className="mt-3 font-semibold">Or start services individually:</p>
            <ul className="list-disc list-inside mt-1 ml-2">
              <li>git-service (port 3004)</li>
              <li>claude-service (port 3002)</li>
              <li>gateway (port 3000)</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>;
}