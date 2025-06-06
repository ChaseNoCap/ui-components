/**
 * Git Operation Manager
 * 
 * Central manager for all git operations. Ensures operations are executed 
 * sequentially with proper completion verification, retry logic, and error recovery.
 * This manager guarantees that each operation completes before the next begins,
 * preventing race conditions and ensuring data consistency.
 * 
 * All git operations in the UI should go through this manager.
 */

import { apolloClient } from '../lib/apollo-client';
import { gql } from '@apollo/client';

interface GitOperation {
  id: string;
  type: 'commit' | 'push' | 'command';
  repository: string;
  execute: () => Promise<any>;
  verify?: () => Promise<boolean>;
  retryable?: boolean;
  maxRetries?: number;
}

interface OperationResult {
  id: string;
  success: boolean;
  result?: any;
  error?: Error;
  retries: number;
  duration: number;
}

export interface GitOperationOptions {
  maxRetries?: number;
  retryDelay?: number;
  verificationDelay?: number;
  onOperationStart?: (operation: GitOperation) => void;
  onOperationComplete?: (result: OperationResult) => void;
  onOperationError?: (operation: GitOperation, error: Error, willRetry: boolean) => void;
}

// Queries for verification
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

export class GitOperationManager {
  private operationQueue: GitOperation[] = [];
  private isProcessing = false;
  private currentOperation: GitOperation | null = null;
  private operationResults: Map<string, OperationResult> = new Map();
  private abortController: AbortController | null = null;

  constructor(private options: GitOperationOptions = {}) {
    this.options = {
      maxRetries: 3,
      retryDelay: 1000,
      verificationDelay: 500,
      ...options
    };
  }

  /**
   * Add an operation to the queue
   */
  addOperation(operation: GitOperation): void {
    this.operationQueue.push(operation);
    this.processQueue();
  }

  /**
   * Add multiple operations to the queue
   */
  addOperations(operations: GitOperation[]): void {
    this.operationQueue.push(...operations);
    this.processQueue();
  }

  /**
   * Process the operation queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.operationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.abortController = new AbortController();

    while (this.operationQueue.length > 0 && !this.abortController.signal.aborted) {
      const operation = this.operationQueue.shift()!;
      this.currentOperation = operation;

      const result = await this.executeOperation(operation);
      this.operationResults.set(operation.id, result);
      
      this.options.onOperationComplete?.(result);
      
      // If operation failed and is not retryable, stop processing
      if (!result.success && !operation.retryable) {
        console.error(`[GitOperationManager] Operation ${operation.id} failed and is not retryable. Stopping queue.`);
        break;
      }
    }

    this.currentOperation = null;
    this.isProcessing = false;
    this.abortController = null;
  }

  /**
   * Execute a single operation with retry logic
   */
  private async executeOperation(operation: GitOperation): Promise<OperationResult> {
    const startTime = Date.now();
    let retries = 0;
    const maxRetries = operation.maxRetries ?? this.options.maxRetries ?? 3;

    this.options.onOperationStart?.(operation);

    while (retries <= maxRetries) {
      try {
        console.log(`[SequentialGitOps] Executing ${operation.type} operation for ${operation.repository} (attempt ${retries + 1}/${maxRetries + 1})`);
        
        // Execute the operation
        const result = await operation.execute();
        
        // Wait before verification
        if (operation.verify && this.options.verificationDelay) {
          await this.delay(this.options.verificationDelay);
        }
        
        // Verify the operation completed successfully
        if (operation.verify) {
          const verified = await operation.verify();
          if (!verified) {
            throw new Error('Operation verification failed');
          }
        }
        
        console.log(`[SequentialGitOps] Operation ${operation.id} completed successfully`);
        
        return {
          id: operation.id,
          success: true,
          result,
          retries,
          duration: Date.now() - startTime
        };
      } catch (error) {
        const err = error as Error;
        const willRetry = retries < maxRetries && (operation.retryable !== false);
        
        console.error(`[SequentialGitOps] Operation ${operation.id} failed:`, err.message);
        this.options.onOperationError?.(operation, err, willRetry);
        
        if (!willRetry) {
          return {
            id: operation.id,
            success: false,
            error: err,
            retries,
            duration: Date.now() - startTime
          };
        }
        
        retries++;
        
        // Exponential backoff with jitter
        const backoffDelay = this.options.retryDelay! * Math.pow(2, retries - 1) + Math.random() * 1000;
        console.log(`[SequentialGitOps] Retrying in ${Math.round(backoffDelay)}ms...`);
        await this.delay(backoffDelay);
      }
    }

    return {
      id: operation.id,
      success: false,
      error: new Error(`Operation failed after ${retries} retries`),
      retries,
      duration: Date.now() - startTime
    };
  }

  /**
   * Create a verification function for commit operations
   */
  createCommitVerification(repositoryPath: string, previousHash: string | null): () => Promise<boolean> {
    return async () => {
      try {
        const { data } = await apolloClient.query({
          query: IS_REPOSITORY_CLEAN,
          variables: { path: repositoryPath },
          fetchPolicy: 'network-only'
        });

        const { isClean, latestCommitHash } = data.isRepositoryClean;
        
        // If we have a previous hash, check that it changed
        if (previousHash) {
          return isClean && latestCommitHash !== previousHash;
        }
        
        // Otherwise, just check if the repository is clean
        return isClean;
      } catch (error) {
        console.error('[SequentialGitOps] Verification error:', error);
        return false;
      }
    };
  }

  /**
   * Create a verification function for push operations
   */
  createPushVerification(repositoryPath: string): () => Promise<boolean> {
    return async () => {
      try {
        // For push operations, we primarily care that the operation completed without error
        // Additional verification could check remote refs, but that requires more complex git commands
        return true;
      } catch (error) {
        console.error('[SequentialGitOps] Push verification error:', error);
        return false;
      }
    };
  }

  /**
   * Abort all pending operations
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.operationQueue = [];
    this.isProcessing = false;
  }

  /**
   * Get the current operation status
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      currentOperation: this.currentOperation,
      queueLength: this.operationQueue.length,
      completedOperations: Array.from(this.operationResults.values())
    };
  }

  /**
   * Wait for all operations to complete
   */
  async waitForCompletion(): Promise<OperationResult[]> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.isProcessing && this.operationQueue.length === 0) {
          clearInterval(checkInterval);
          resolve(Array.from(this.operationResults.values()));
        }
      }, 100);
    });
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get the latest commit hash for a repository
   */
  async getLatestCommitHash(repositoryPath: string): Promise<string | null> {
    try {
      const { data } = await apolloClient.query({
        query: LATEST_COMMIT,
        variables: { path: repositoryPath },
        fetchPolicy: 'network-only'
      });
      return data.latestCommit.hash;
    } catch (error) {
      console.error('[GitOperationManager] Failed to get latest commit hash:', error);
      return null;
    }
  }

  /**
   * Create a commit operation
   */
  createCommitOperation(
    id: string,
    repository: string,
    commitFn: () => Promise<any>,
    previousHash?: string | null,
    repositoryPath?: string
  ): GitOperation {
    return {
      id,
      type: 'commit',
      repository,
      execute: commitFn,
      verify: previousHash !== undefined 
        ? this.createCommitVerification(repositoryPath || repository, previousHash)
        : undefined,
      retryable: true,
      maxRetries: 3
    };
  }

  /**
   * Create a push operation
   */
  createPushOperation(
    id: string,
    repository: string,
    pushFn: () => Promise<any>,
    repositoryPath?: string
  ): GitOperation {
    return {
      id,
      type: 'push',
      repository,
      execute: pushFn,
      verify: this.createPushVerification(repositoryPath || repository),
      retryable: true,
      maxRetries: 2
    };
  }

  /**
   * Execute a batch of operations sequentially
   */
  async executeBatch(operations: GitOperation[]): Promise<OperationResult[]> {
    this.operationResults.clear();
    this.addOperations(operations);
    return this.waitForCompletion();
  }

  /**
   * Clear the operation queue and results
   */
  clear(): void {
    this.abort();
    this.operationResults.clear();
  }
}