import React from 'react';
import { useQuery } from '@apollo/client';
import { SESSION_WITH_REPOSITORY_QUERY, ACTIVE_SESSIONS_WITH_REPOS_QUERY } from '../graphql/federation-operations';

export const FederationDemo: React.FC = () => {
  // Query that demonstrates federation - Claude session with repository data from Repo Agent
  const { data, loading, error } = useQuery(ACTIVE_SESSIONS_WITH_REPOS_QUERY);

  if (loading) return <div className="p-4">Loading federated data...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error.message}</div>;

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Federation Demo</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        This component demonstrates Apollo Federation by fetching Claude sessions 
        and automatically resolving repository data from the Repo Agent service.
      </p>
      
      <div className="space-y-4">
        {data?.sessions?.length === 0 ? (
          <div className="p-4 bg-yellow-100 dark:bg-yellow-900 rounded">
            No active sessions. Start a Claude session to see federation in action.
          </div>
        ) : (
          data?.sessions?.map((session: any) => (
            <div key={session.id} className="p-4 bg-white dark:bg-gray-700 rounded shadow">
              <h3 className="font-semibold mb-2">Session: {session.id}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Status:</span> {session.status}
                </div>
                <div>
                  <span className="text-gray-500">Created:</span> {new Date(session.createdAt).toLocaleString()}
                </div>
                <div>
                  <span className="text-gray-500">Working Directory:</span> {session.workingDirectory || 'N/A'}
                </div>
                {session.repository && (
                  <>
                    <div>
                      <span className="text-gray-500">Repository:</span> {session.repository.path}
                    </div>
                    <div>
                      <span className="text-gray-500">Branch:</span> {session.repository.branch}
                    </div>
                    <div>
                      <span className="text-gray-500">Dirty:</span> {session.repository.isDirty ? 'Yes' : 'No'}
                    </div>
                    <div>
                      <span className="text-gray-500">Uncommitted:</span> {session.repository.uncommittedCount}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="mt-6 p-4 bg-blue-100 dark:bg-blue-900 rounded">
        <h4 className="font-semibold mb-2">How Federation Works Here:</h4>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>The UI queries the Gateway for Claude sessions</li>
          <li>Claude service returns session data with a repository path</li>
          <li>Gateway automatically fetches repository details from Repo Agent</li>
          <li>UI receives combined data in a single response</li>
        </ol>
      </div>
    </div>
  );
};

// Example of a more complex federated query component
export const RepositoryAnalysisDemo: React.FC<{ repoPath: string }> = ({ repoPath }) => {
  const { data, loading, error } = useQuery(SESSION_WITH_REPOSITORY_QUERY, {
    variables: { sessionId: 'example-session-id' },
    skip: !repoPath
  });

  if (loading) return <div>Loading repository analysis...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const session = data?.session;
  if (!session) return null;

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">Repository Analysis</h3>
      <div className="space-y-2 text-sm">
        <div>Session: {session.id}</div>
        {session.repository && (
          <>
            <div>Repository: {session.repository.name}</div>
            <div>Status: {session.repository.isDirty ? 'Has changes' : 'Clean'}</div>
            <div>Files changed: {session.repository.status?.files?.length || 0}</div>
          </>
        )}
      </div>
    </div>
  );
};