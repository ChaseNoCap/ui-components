import { useState, useCallback } from 'react';
import { gql } from '@apollo/client';
import { apolloClient as client } from '../lib/apollo-client';

// GraphQL queries
const IS_REPOSITORY_CLEAN = gql`
  query IsRepositoryClean($path: String!) {
    isRepositoryClean(path: $path) {
      isClean
      uncommittedFiles
      latestCommitHash
      repository
    }
  }
`;

const LATEST_COMMIT = gql`
  query LatestCommit($path: String!) {
    latestCommit(path: $path) {
      hash
      shortHash
      message
      author
      timestamp
      repository
    }
  }
`;

interface UseGitOperationCompletionOptions {
  pollingInterval?: number;
  maxAttempts?: number;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export function useGitOperationCompletion(options: UseGitOperationCompletionOptions = {}) {
  const {
    pollingInterval = 500, // Poll every 500ms
    maxAttempts = 20, // Max 10 seconds
    onComplete,
    onError
  } = options;

  const [isWaiting, setIsWaiting] = useState(false);
  const [attempts, setAttempts] = useState(0);

  /**
   * Wait for a commit operation to complete by checking if the repository is clean
   * and the commit hash has changed
   */
  const waitForCommitCompletion = useCallback(async (
    repositoryPath: string,
    previousCommitHash?: string,
    expectedClean: boolean = true
  ): Promise<boolean> => {
    setIsWaiting(true);
    setAttempts(0);

    return new Promise((resolve, reject) => {
      let attemptCount = 0;
      
      const checkStatus = async () => {
        attemptCount++;
        setAttempts(attemptCount);

        try {
          // Query the repository status
          const { data } = await client.query({
            query: IS_REPOSITORY_CLEAN,
            variables: { path: repositoryPath },
            fetchPolicy: 'network-only' // Always fetch fresh data
          });

          const { isClean, latestCommitHash, uncommittedFiles } = data.isRepositoryClean;

          // If we couldn't capture the previous hash, we can't verify by hash change
          const hashChanged = previousCommitHash 
            ? latestCommitHash !== previousCommitHash 
            : false;
          
          const cleanConditionMet = expectedClean ? isClean : true;
          
          // If we have no previous hash, rely only on clean status
          // If we have a previous hash, require both hash change AND clean status
          const isComplete = previousCommitHash 
            ? (cleanConditionMet && hashChanged)
            : (cleanConditionMet && isClean);

          console.log(`[Git Operation] Checking ${repositoryPath}:`, {
            attempt: attemptCount,
            isClean,
            uncommittedFiles,
            previousHash: previousCommitHash,
            currentHash: latestCommitHash,
            hashChanged,
            expectedClean,
            isComplete
          });

          if (isComplete) {
            console.log(`[Git Operation] Operation complete for ${repositoryPath}`);
            setIsWaiting(false);
            onComplete?.();
            resolve(true);
            return;
          }

          // Check if we've exceeded max attempts
          if (attemptCount >= maxAttempts) {
            const error = new Error(
              `Git operation did not complete after ${maxAttempts} attempts. ` +
              `Repository still has ${data.isRepositoryClean.uncommittedFiles} uncommitted files.`
            );
            setIsWaiting(false);
            onError?.(error);
            reject(error);
            return;
          }

          // Continue polling
          setTimeout(checkStatus, pollingInterval);
        } catch (error) {
          setIsWaiting(false);
          const err = error instanceof Error ? error : new Error('Failed to check repository status');
          onError?.(err);
          reject(err);
        }
      };

      // Start checking
      checkStatus();
    });
  }, [pollingInterval, maxAttempts, onComplete, onError]);

  /**
   * Wait for multiple repositories to complete their operations
   */
  const waitForBatchCompletion = useCallback(async (
    repositories: Array<{
      path: string;
      previousCommitHash?: string;
    }>,
    expectedClean: boolean = true
  ): Promise<boolean> => {
    setIsWaiting(true);
    setAttempts(0);
    
    console.log(`[Git Operation] Starting batch completion check for ${repositories.length} repositories`);

    return new Promise((resolve, reject) => {
      let attemptCount = 0;
      
      const checkAllStatuses = async () => {
        attemptCount++;
        setAttempts(attemptCount);

        try {
          // Check all repositories in parallel
          const statuses = await Promise.all(
            repositories.map(async repo => {
              try {
                const { data } = await client.query({
                  query: IS_REPOSITORY_CLEAN,
                  variables: { path: repo.path },
                  fetchPolicy: 'network-only'
                });

                const { isClean, latestCommitHash, uncommittedFiles } = data.isRepositoryClean;
                
                // If we couldn't capture the previous hash, we can't verify by hash change
                // In this case, just check if the repo is clean
                const hashChanged = repo.previousCommitHash 
                  ? latestCommitHash !== repo.previousCommitHash 
                  : false; // Don't assume completion if we have no baseline
                
                const cleanConditionMet = expectedClean ? isClean : true;
                
                // If we have no previous hash, rely only on clean status
                // If we have a previous hash, require both hash change AND clean status
                const isComplete = repo.previousCommitHash 
                  ? (cleanConditionMet && hashChanged)
                  : (cleanConditionMet && isClean);

                console.log(`[Git Operation] Batch check ${repo.path}:`, {
                  isComplete,
                  isClean,
                  uncommittedFiles,
                  hashChanged,
                  previousHash: repo.previousCommitHash,
                  currentHash: latestCommitHash
                });

                return { repo: repo.path, isComplete };
              } catch (error) {
                console.error(`[Git Operation] Error checking ${repo.path}:`, error);
                return { repo: repo.path, isComplete: false };
              }
            })
          );

          // Check if all repositories are complete
          const allComplete = statuses.every(status => status.isComplete);

          if (allComplete) {
            console.log('[Git Operation] All repositories complete!');
            setIsWaiting(false);
            onComplete?.();
            resolve(true);
            return;
          }

          // Check if we've exceeded max attempts
          if (attemptCount >= maxAttempts) {
            const incompleteRepos = statuses
              .filter(s => !s.isComplete)
              .map(s => s.repo)
              .join(', ');
            const error = new Error(
              `Git operations did not complete after ${maxAttempts} attempts. ` +
              `Incomplete repositories: ${incompleteRepos}`
            );
            setIsWaiting(false);
            onError?.(error);
            reject(error);
            return;
          }

          // Continue polling
          setTimeout(checkAllStatuses, pollingInterval);
        } catch (error) {
          setIsWaiting(false);
          const err = error instanceof Error ? error : new Error('Failed to check batch status');
          onError?.(err);
          reject(err);
        }
      };

      // Start checking
      checkAllStatuses();
    });
  }, [pollingInterval, maxAttempts, onComplete, onError]);

  /**
   * Get the latest commit hash for a repository before an operation
   */
  const getLatestCommitHash = useCallback(async (repositoryPath: string): Promise<string | null> => {
    try {
      const { data } = await client.query({
        query: LATEST_COMMIT,
        variables: { path: repositoryPath },
        fetchPolicy: 'network-only'
      });

      return data.latestCommit.hash;
    } catch (error) {
      console.error('Failed to get latest commit hash:', error);
      return null;
    }
  }, []);

  return {
    isWaiting,
    attempts,
    waitForCommitCompletion,
    waitForBatchCompletion,
    getLatestCommitHash
  };
}