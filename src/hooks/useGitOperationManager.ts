import { useState, useRef, useCallback, useEffect } from 'react';
import { GitOperationManager, GitOperationOptions } from '../services/GitOperationManager';
import { toast } from '../lib/toast';

interface UseGitOperationManagerOptions extends GitOperationOptions {
  showToasts?: boolean;
}

export function useGitOperationManager(options: UseGitOperationManagerOptions = {}) {
  const { showToasts = true, ...managerOptions } = options;
  const managerRef = useRef<GitOperationManager | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<string | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  // Initialize manager
  useEffect(() => {
    if (!managerRef.current) {
      managerRef.current = new GitOperationManager({
        ...managerOptions,
        onOperationStart: (operation) => {
          setCurrentOperation(`${operation.type} ${operation.repository}`);
          if (showToasts) {
            toast.info(`Starting ${operation.type} for ${operation.repository}...`);
          }
        },
        onOperationComplete: (result) => {
          if (showToasts) {
            if (result.success) {
              toast.success(`Completed ${result.id}`);
            } else {
              toast.error(`Failed ${result.id}: ${result.error?.message}`);
            }
          }
          setProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
        },
        onOperationError: (operation, error, willRetry) => {
          if (showToasts && !willRetry) {
            toast.error(`${operation.type} failed for ${operation.repository}: ${error.message}`);
          }
        }
      });
    }
  }, []);

  // Get manager instance
  const getManager = useCallback(() => {
    if (!managerRef.current) {
      throw new Error('GitOperationManager not initialized');
    }
    return managerRef.current;
  }, []);

  // Execute operations
  const executeOperations = useCallback(async (operations: any[]) => {
    const manager = getManager();
    setIsProcessing(true);
    setProgress({ completed: 0, total: operations.length });
    
    try {
      const results = await manager.executeBatch(operations);
      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;
      
      if (showToasts) {
        if (failed === 0) {
          toast.success(`All ${successful} operations completed successfully`);
        } else {
          toast.warning(`${successful} operations succeeded, ${failed} failed`);
        }
      }
      
      return results;
    } finally {
      setIsProcessing(false);
      setCurrentOperation(null);
      setProgress({ completed: 0, total: 0 });
    }
  }, [getManager, showToasts]);

  // Create commit operation
  const createCommitOperation = useCallback((
    id: string,
    repository: string,
    commitFn: () => Promise<any>,
    previousHash?: string | null
  ) => {
    return getManager().createCommitOperation(id, repository, commitFn, previousHash);
  }, [getManager]);

  // Create push operation  
  const createPushOperation = useCallback((
    id: string,
    repository: string,
    pushFn: () => Promise<any>
  ) => {
    return getManager().createPushOperation(id, repository, pushFn);
  }, [getManager]);

  // Get latest commit hash
  const getLatestCommitHash = useCallback(async (repositoryPath: string) => {
    return getManager().getLatestCommitHash(repositoryPath);
  }, [getManager]);

  // Abort operations
  const abort = useCallback(() => {
    getManager().abort();
    setIsProcessing(false);
    setCurrentOperation(null);
    setProgress({ completed: 0, total: 0 });
  }, [getManager]);

  // Clear manager
  const clear = useCallback(() => {
    getManager().clear();
    setProgress({ completed: 0, total: 0 });
  }, [getManager]);

  return {
    isProcessing,
    currentOperation,
    progress,
    executeOperations,
    createCommitOperation,
    createPushOperation,
    getLatestCommitHash,
    abort,
    clear
  };
}