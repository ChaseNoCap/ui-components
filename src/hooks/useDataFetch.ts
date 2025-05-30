import { useState, useEffect, useCallback, useRef } from 'react';
import { dataFetcher, FetchOptions, FetchResult } from '../services/dataFetcher';
import { useToastContext } from '../components/Toast';

interface UseDataFetchOptions extends FetchOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export function useDataFetch<T>(
  fetchFn: (options?: FetchOptions) => Promise<FetchResult<T>>,
  options: UseDataFetchOptions = {}
) {
  const {
    autoRefresh = false,
    refreshInterval = 30000,
    onSuccess,
    onError,
    ...fetchOptions
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { showError, showWarning } = useToastContext();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstLoad = useRef(true);

  const fetch = useCallback(async (isManualRefresh = false) => {
    try {
      // Set loading state based on whether it's first load or refresh
      if (isFirstLoad.current || isManualRefresh) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      const result = await fetchFn({
        ...fetchOptions,
        onRetry: (attempt, error) => {
          if (isFirstLoad.current) {
            console.log(`Retry attempt ${attempt} after error:`, error);
          }
        },
      });

      if (result.isError && result.error) {
        throw result.error;
      }

      setData(result.data);
      setError(null);
      onSuccess?.(result.data);
      
      isFirstLoad.current = false;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);

      // Show appropriate toast based on context
      if (isFirstLoad.current) {
        // First load failure - show error
        showError('Failed to load data', error.message);
      } else if (isManualRefresh) {
        // Manual refresh failure - show error
        showError('Refresh failed', error.message);
      } else {
        // Auto-refresh failure - show warning
        showWarning('Auto-refresh failed', 'Data may be outdated');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchFn, fetchOptions, onSuccess, onError, showError, showWarning]);

  // Initial fetch
  useEffect(() => {
    fetch();
  }, []);

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetch(false);
      }, refreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, fetch]);

  const refresh = useCallback(() => {
    return fetch(true);
  }, [fetch]);

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    refresh,
  };
}