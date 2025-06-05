import { GitOperationManager } from '../GitOperationManager';

describe('GitOperationManager', () => {
  let manager: GitOperationManager;

  beforeEach(() => {
    manager = new GitOperationManager({
      maxRetries: 2,
      retryDelay: 100,
      verificationDelay: 50
    });
  });

  afterEach(() => {
    manager.clear();
  });

  describe('Sequential Execution', () => {
    it('should execute operations sequentially', async () => {
      const executionOrder: string[] = [];
      
      const op1 = {
        id: 'op1',
        type: 'commit' as const,
        repository: 'repo1',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          executionOrder.push('op1');
          return { success: true };
        }
      };

      const op2 = {
        id: 'op2',
        type: 'commit' as const,
        repository: 'repo2',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          executionOrder.push('op2');
          return { success: true };
        }
      };

      const results = await manager.executeBatch([op1, op2]);

      expect(executionOrder).toEqual(['op1', 'op2']);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should retry failed operations', async () => {
      let attempts = 0;
      
      const operation = {
        id: 'retry-op',
        type: 'commit' as const,
        repository: 'repo',
        execute: async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Temporary failure');
          }
          return { success: true };
        },
        retryable: true
      };

      const results = await manager.executeBatch([operation]);

      expect(attempts).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[0].retries).toBe(1);
    });

    it('should stop on non-retryable failures', async () => {
      const executionOrder: string[] = [];
      
      const op1 = {
        id: 'op1',
        type: 'commit' as const,
        repository: 'repo1',
        execute: async () => {
          executionOrder.push('op1');
          throw new Error('Fatal error');
        },
        retryable: false
      };

      const op2 = {
        id: 'op2',
        type: 'commit' as const,
        repository: 'repo2',
        execute: async () => {
          executionOrder.push('op2');
          return { success: true };
        }
      };

      const results = await manager.executeBatch([op1, op2]);

      expect(executionOrder).toEqual(['op1']); // op2 should not execute
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
    });

    it('should verify operations when verification is provided', async () => {
      let verified = false;
      
      const operation = {
        id: 'verify-op',
        type: 'commit' as const,
        repository: 'repo',
        execute: async () => ({ success: true }),
        verify: async () => {
          verified = true;
          return true;
        }
      };

      await manager.executeBatch([operation]);

      expect(verified).toBe(true);
    });
  });

  describe('Operation Creation', () => {
    it('should create commit operations with verification', () => {
      const commitFn = jest.fn().mockResolvedValue({ success: true });
      const operation = manager.createCommitOperation(
        'commit-1',
        'repo1',
        commitFn,
        'previous-hash'
      );

      expect(operation.id).toBe('commit-1');
      expect(operation.type).toBe('commit');
      expect(operation.repository).toBe('repo1');
      expect(operation.execute).toBe(commitFn);
      expect(operation.verify).toBeDefined();
      expect(operation.retryable).toBe(true);
      expect(operation.maxRetries).toBe(3);
    });

    it('should create push operations', () => {
      const pushFn = jest.fn().mockResolvedValue({ success: true });
      const operation = manager.createPushOperation(
        'push-1',
        'repo1',
        pushFn
      );

      expect(operation.id).toBe('push-1');
      expect(operation.type).toBe('push');
      expect(operation.repository).toBe('repo1');
      expect(operation.execute).toBe(pushFn);
      expect(operation.verify).toBeDefined();
      expect(operation.retryable).toBe(true);
      expect(operation.maxRetries).toBe(2);
    });
  });

  describe('Status and Control', () => {
    it('should report processing status', async () => {
      const operation = {
        id: 'status-op',
        type: 'commit' as const,
        repository: 'repo',
        execute: async () => {
          const status = manager.getStatus();
          expect(status.isProcessing).toBe(true);
          expect(status.currentOperation?.id).toBe('status-op');
          return { success: true };
        }
      };

      manager.addOperation(operation);
      await manager.waitForCompletion();

      const finalStatus = manager.getStatus();
      expect(finalStatus.isProcessing).toBe(false);
      expect(finalStatus.currentOperation).toBe(null);
      expect(finalStatus.completedOperations).toHaveLength(1);
    });

    it('should abort pending operations', async () => {
      const executionOrder: string[] = [];
      
      const slowOp = {
        id: 'slow-op',
        type: 'commit' as const,
        repository: 'repo1',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          executionOrder.push('slow-op');
          return { success: true };
        }
      };

      const pendingOp = {
        id: 'pending-op',
        type: 'commit' as const,
        repository: 'repo2',
        execute: async () => {
          executionOrder.push('pending-op');
          return { success: true };
        }
      };

      manager.addOperations([slowOp, pendingOp]);
      
      // Abort after a short delay
      setTimeout(() => manager.abort(), 50);
      
      await manager.waitForCompletion();

      expect(executionOrder).toEqual([]); // No operations should complete
    });
  });
});