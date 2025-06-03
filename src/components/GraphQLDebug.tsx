import React, { useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { SystemHealthMonitor } from './GraphQLDebug/SystemHealthMonitor';

const TEST_QUERY = gql`
  query DebugScanAllDetailed {
    scanAllDetailed {
      statistics {
        totalRepositories
        dirtyRepositories
      }
      metadata {
        startTime
        workspaceRoot
      }
    }
  }
`;

export const GraphQLDebug: React.FC = () => {
  const [showDebug, setShowDebug] = useState(false);
  const { data, loading, error, refetch } = useQuery(TEST_QUERY, {
    skip: !showDebug,
    fetchPolicy: 'network-only',
    errorPolicy: 'all',
    onCompleted: (data) => {
      console.log('✅ Query completed:', data);
    },
    onError: (error) => {
      console.error('❌ Query error:', error);
    }
  });

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!showDebug ? (
        <Button
          onClick={() => setShowDebug(true)}
          size="sm"
          variant="outline"
        >
          Debug GraphQL
        </Button>
      ) : (
        <Card className="w-96 p-4 bg-white dark:bg-gray-800 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">GraphQL Debug</h3>
            <Button
              onClick={() => setShowDebug(false)}
              size="sm"
              variant="ghost"
            >
              ✕
            </Button>
          </div>
          
          <div className="space-y-2 text-sm">
            <div>
              <strong>Endpoint:</strong> {import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:3000/graphql'}
            </div>
            <div>
              <strong>Status:</strong> {loading ? '⏳ Loading...' : error ? '❌ Error' : '✅ Success'}
            </div>
            
            {error && (
              <div className="mt-2 p-2 bg-red-100 dark:bg-red-900 rounded text-xs">
                <strong>Error:</strong> {error.message}
                {error.networkError && (
                  <div className="mt-1">
                    <strong>Network:</strong> {error.networkError.message}
                  </div>
                )}
                {error.graphQLErrors?.length > 0 && (
                  <div className="mt-1">
                    <strong>GraphQL:</strong> {error.graphQLErrors[0].message}
                  </div>
                )}
              </div>
            )}
            
            {data && (
              <div className="mt-2 p-2 bg-green-100 dark:bg-green-900 rounded text-xs">
                <pre>{JSON.stringify(data, null, 2)}</pre>
              </div>
            )}
            
            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => refetch()}
                size="sm"
                disabled={loading}
              >
                Test Query
              </Button>
              <Button
                onClick={() => {
                  if ((window as any).testGraphQLConnection) {
                    (window as any).testGraphQLConnection();
                  }
                }}
                size="sm"
                variant="outline"
              >
                Run Tests
              </Button>
            </div>
          </div>
        </Card>
      )}
      {showDebug && (
        <div className="fixed bottom-20 right-4 z-50 mb-4">
          <SystemHealthMonitor />
        </div>
      )}
    </div>
  );
};