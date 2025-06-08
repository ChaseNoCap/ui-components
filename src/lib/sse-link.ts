import { ApolloLink, Operation, FetchResult, Observable } from '@apollo/client/core';
import { print } from 'graphql';

// Connection state enum for better tracking
export enum ConnectionState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  DISCONNECTED = 'DISCONNECTED',
  FAILED = 'FAILED'
}

// Error categorization for better handling
export enum ErrorCategory {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  CLIENT_ERROR = 'CLIENT_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  PARSE_ERROR = 'PARSE_ERROR'
}

interface SseLinkOptions {
  url: string;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  retry?: {
    attempts?: number;
    delay?: number;
    maxDelay?: number;
  };
  onNonLazyError?: (error: any) => void;
  generateID?: () => string;
  heartbeatTimeout?: number;
  debug?: {
    enabled?: boolean;
    logLevel?: 'verbose' | 'debug' | 'info' | 'warn' | 'error';
  };
}

interface SubscriptionConnection<T = any> {
  eventSource: EventSource;
  observer: TypedObserver<T>;
  operationName?: string;
  reconnectAttempts: number;
  reconnectTimer?: NodeJS.Timeout;
  heartbeatTimer?: NodeJS.Timeout;
  state: ConnectionState;
  lastError?: CategorizedError;
  createdAt: number;
  lastActivityAt: number;
}

interface TypedObserver<T> {
  next: (value: FetchResult<T>) => void;
  error: (error: Error) => void;
  complete: () => void;
}

interface CategorizedError extends Error {
  category: ErrorCategory;
  originalError?: any;
  retryable: boolean;
  statusCode?: number;
}

/**
 * SSE Link - Apollo Link implementation for Server-Sent Events subscriptions
 * Built from scratch using native EventSource API to provide full control
 * 
 * This implementation creates one EventSource connection per subscription
 * as expected by the server implementation
 */
export class SseLink<TContext = any> extends ApolloLink {
  private options: SseLinkOptions;
  private subscriptions: Map<string, SubscriptionConnection> = new Map();
  private connectionStates: Map<string, ConnectionState> = new Map();
  // Use WeakMap to prevent memory leaks with observer references
  private observerRefs: WeakMap<TypedObserver<any>, string> = new WeakMap();

  constructor(options: SseLinkOptions) {
    super();
    this.options = {
      credentials: 'include',
      retry: {
        attempts: 5,
        delay: 1000,
        maxDelay: 30000,
      },
      heartbeatTimeout: 60000, // 60s - double the server's 30s heartbeat for safety
      debug: {
        enabled: false,
        logLevel: 'info',
      },
      ...options,
    };
  }

  public request<TData = any, TVariables = any>(
    operation: Operation<TVariables>
  ): Observable<FetchResult<TData>> | null {
    return new Observable<FetchResult<TData>>((observer) => {
      const subscriptionId = this.options.generateID?.() || Math.random().toString(36).substring(2);
      
      // Type-safe observer
      const typedObserver: TypedObserver<TData> = {
        next: observer.next.bind(observer),
        error: observer.error.bind(observer),
        complete: observer.complete.bind(observer),
      };
      
      // Track observer reference for cleanup
      this.observerRefs.set(typedObserver, subscriptionId);
      
      this.log('info', `Starting subscription: ${operation.operationName}`, {
        subscriptionId,
        variables: operation.variables,
      });

      // Update connection state
      this.updateConnectionState(subscriptionId, ConnectionState.CONNECTING);

      // Create a dedicated EventSource for this subscription
      const eventSource = this.createEventSource(operation, subscriptionId, typedObserver);
      
      // Store the subscription
      const now = Date.now();
      this.subscriptions.set(subscriptionId, {
        eventSource,
        observer: typedObserver,
        operationName: operation.operationName,
        reconnectAttempts: 0,
        state: ConnectionState.CONNECTING,
        createdAt: now,
        lastActivityAt: now,
      });

      // Return cleanup function
      return () => {
        this.log('debug', `Cleaning up ${operation.operationName}`);
        this.cleanupSubscription(subscriptionId);
        this.observerRefs.delete(typedObserver);
      };
    });
  }

  private createEventSource<TData>(
    operation: Operation, 
    subscriptionId: string, 
    observer: TypedObserver<TData>
  ): EventSource {
    // Build URL with query parameters as expected by the server
    const url = new URL(this.options.url);
    url.searchParams.set('query', print(operation.query));
    if (operation.variables && Object.keys(operation.variables).length > 0) {
      url.searchParams.set('variables', JSON.stringify(operation.variables));
    }
    if (operation.operationName) {
      url.searchParams.set('operationName', operation.operationName);
    }

    this.log('verbose', 'Creating EventSource connection:', url.toString());

    // Create EventSource with credentials support
    const eventSource = new EventSource(url.toString(), {
      withCredentials: this.options.credentials === 'include',
    });

    // Handle connection open
    eventSource.onopen = () => {
      this.log('info', `SSE connection established for ${operation.operationName}`);
      const subscription = this.subscriptions.get(subscriptionId);
      if (subscription) {
        subscription.reconnectAttempts = 0;
        subscription.lastActivityAt = Date.now();
        this.updateConnectionState(subscriptionId, ConnectionState.CONNECTED);
        this.startHeartbeatMonitor(subscriptionId);
      }
    };

    // Handle the 'next' event for subscription data
    eventSource.addEventListener('next', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        this.log('verbose', `Received data for ${operation.operationName}:`, data);
        
        // Update activity timestamp
        const subscription = this.subscriptions.get(subscriptionId);
        if (subscription) {
          subscription.lastActivityAt = Date.now();
        }
        
        observer.next(data);
        
        // Reset heartbeat timer on data received
        this.resetHeartbeatMonitor(subscriptionId);
      } catch (error) {
        const categorizedError = this.categorizeError(error, ErrorCategory.PARSE_ERROR);
        this.log('error', 'Failed to parse next event:', { error, eventData: event.data });
        this.updateLastError(subscriptionId, categorizedError);
        observer.error(categorizedError);
      }
    });

    // Handle the 'error' event (server-sent error events)
    eventSource.addEventListener('error', (event: MessageEvent) => {
      this.log('debug', `Received error event for ${operation.operationName}`, { 
        eventType: event.type,
        hasData: !!event.data,
        data: event.data 
      });
      
      try {
        // Check if event.data is undefined or empty
        if (!event.data || event.data === 'undefined') {
          this.log('warn', `Empty error event for ${operation.operationName}, ignoring`);
          return;
        }
        
        const data = JSON.parse(event.data);
        const errorMessage = data.errors?.[0]?.message || data.message || 'Unknown subscription error';
        
        // Categorize based on error content
        let category = ErrorCategory.SERVER_ERROR;
        if (data.errors?.[0]?.extensions?.code === 'UNAUTHENTICATED') {
          category = ErrorCategory.AUTH_ERROR;
        }
        
        const categorizedError = this.categorizeError(
          new Error(errorMessage),
          category,
          data
        );
        
        this.log('error', `Subscription error for ${operation.operationName}:`, errorMessage);
        this.updateLastError(subscriptionId, categorizedError);
        observer.error(categorizedError);
      } catch (error) {
        // Only treat as parse error if there was actual data to parse
        if (event.data && event.data !== 'undefined') {
          const categorizedError = this.categorizeError(error, ErrorCategory.PARSE_ERROR);
          this.log('error', 'Failed to parse error event:', { error, eventData: event.data });
          observer.error(categorizedError);
        }
      }
    });

    // Handle the 'complete' event
    eventSource.addEventListener('complete', () => {
      this.log('info', `Subscription completed for ${operation.operationName}`);
      this.updateConnectionState(subscriptionId, ConnectionState.DISCONNECTED);
      observer.complete();
      this.cleanupSubscription(subscriptionId);
    });

    // Handle heartbeat events
    eventSource.addEventListener('heartbeat', () => {
      this.log('debug', `Received heartbeat for ${operation.operationName}`);
      const subscription = this.subscriptions.get(subscriptionId);
      if (subscription) {
        subscription.lastActivityAt = Date.now();
      }
      this.resetHeartbeatMonitor(subscriptionId);
    });

    // Handle generic message events (for heartbeats)
    eventSource.onmessage = (event) => {
      // Heartbeats come as comments, which don't trigger onmessage
      // But if we get a generic message, reset the heartbeat monitor
      const subscription = this.subscriptions.get(subscriptionId);
      if (subscription) {
        subscription.lastActivityAt = Date.now();
      }
      this.resetHeartbeatMonitor(subscriptionId);
    };

    // Handle connection errors
    eventSource.onerror = (error) => {
      // EventSource onerror doesn't provide much detail
      // Check readyState to determine the actual issue
      if (eventSource.readyState === EventSource.CONNECTING) {
        this.log('info', `SSE reconnecting for ${operation.operationName}`);
        return; // Let it reconnect
      } else if (eventSource.readyState === EventSource.CLOSED) {
        const categorizedError = this.categorizeError(
          new Error('SSE connection closed'),
          ErrorCategory.NETWORK_ERROR
        );
        this.log('error', `SSE connection closed for ${operation.operationName}`);
        this.updateLastError(subscriptionId, categorizedError);
        this.handleConnectionError(subscriptionId, operation, observer, categorizedError);
      } else {
        // Open but errored - likely a network issue
        const categorizedError = this.categorizeError(
          new Error('SSE connection error'),
          ErrorCategory.NETWORK_ERROR
        );
        this.log('warn', `SSE connection error for ${operation.operationName}, readyState: ${eventSource.readyState}`);
        this.updateLastError(subscriptionId, categorizedError);
      }
    };

    return eventSource;
  }

  private handleConnectionError<TData>(
    subscriptionId: string, 
    operation: Operation, 
    observer: TypedObserver<TData>,
    error: CategorizedError
  ): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    // Stop heartbeat monitoring
    this.stopHeartbeatMonitor(subscriptionId);

    // Close the failed connection
    subscription.eventSource.close();

    // Determine if we should retry based on error category
    const shouldRetry = this.shouldRetryError(error, subscription.reconnectAttempts);

    if (shouldRetry && subscription.reconnectAttempts < (this.options.retry?.attempts || 5)) {
      this.updateConnectionState(subscriptionId, ConnectionState.RECONNECTING);
      this.scheduleReconnect(subscriptionId, operation, observer);
    } else {
      this.log('error', `Max reconnection attempts reached for ${operation.operationName}`);
      this.updateConnectionState(subscriptionId, ConnectionState.FAILED);
      observer.error(error);
      this.cleanupSubscription(subscriptionId);
    }
  }

  private shouldRetryError(error: CategorizedError, attemptCount: number): boolean {
    // Don't retry auth errors
    if (error.category === ErrorCategory.AUTH_ERROR) {
      return false;
    }

    // Don't retry client errors (4xx)
    if (error.category === ErrorCategory.CLIENT_ERROR && error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return false;
    }

    // Retry network and server errors
    if (error.category === ErrorCategory.NETWORK_ERROR || error.category === ErrorCategory.SERVER_ERROR) {
      return true;
    }

    // Retry timeout errors up to 3 times
    if (error.category === ErrorCategory.TIMEOUT_ERROR && attemptCount < 3) {
      return true;
    }

    return error.retryable;
  }

  private scheduleReconnect<TData>(
    subscriptionId: string, 
    operation: Operation, 
    observer: TypedObserver<TData>
  ): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    const delay = this.calculateReconnectDelay(subscription.reconnectAttempts);
    this.log('info', `Scheduling reconnection for ${operation.operationName} in ${delay}ms (attempt ${subscription.reconnectAttempts + 1})`);
    
    subscription.reconnectTimer = setTimeout(() => {
      subscription.reconnectAttempts++;
      
      // Create a new EventSource connection
      const newEventSource = this.createEventSource(operation, subscriptionId, observer);
      subscription.eventSource = newEventSource;
    }, delay);
  }

  private calculateReconnectDelay(attempt: number): number {
    const baseDelay = this.options.retry?.delay || 1000;
    const maxDelay = this.options.retry?.maxDelay || 30000;
    
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000;
    
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  private startHeartbeatMonitor(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription || !this.options.heartbeatTimeout) return;

    // Set up heartbeat timeout
    subscription.heartbeatTimer = setTimeout(() => {
      const timeoutError = this.categorizeError(
        new Error('Connection timeout - no heartbeat received'),
        ErrorCategory.TIMEOUT_ERROR
      );
      
      this.log('warn', `Heartbeat timeout for ${subscription.operationName}, closing connection`);
      this.updateLastError(subscriptionId, timeoutError);
      subscription.observer.error(timeoutError);
      this.cleanupSubscription(subscriptionId);
    }, this.options.heartbeatTimeout);
  }

  private resetHeartbeatMonitor(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    // Clear existing timer
    if (subscription.heartbeatTimer) {
      clearTimeout(subscription.heartbeatTimer);
    }

    // Start a new timer
    this.startHeartbeatMonitor(subscriptionId);
  }

  private stopHeartbeatMonitor(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription || !subscription.heartbeatTimer) return;

    clearTimeout(subscription.heartbeatTimer);
    subscription.heartbeatTimer = undefined;
  }

  private cleanupSubscription(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    this.log('debug', `Cleaning up subscription ${subscription.operationName}`);

    // Stop heartbeat monitoring
    this.stopHeartbeatMonitor(subscriptionId);

    // Clear reconnect timer
    if (subscription.reconnectTimer) {
      clearTimeout(subscription.reconnectTimer);
      subscription.reconnectTimer = undefined;
    }

    // Close EventSource connection
    subscription.eventSource.close();

    // Update state before removal
    this.updateConnectionState(subscriptionId, ConnectionState.DISCONNECTED);

    // Remove from maps
    this.subscriptions.delete(subscriptionId);
    this.connectionStates.delete(subscriptionId);
  }

  // Helper methods for error categorization
  private categorizeError(
    error: any,
    defaultCategory: ErrorCategory,
    additionalData?: any
  ): CategorizedError {
    const categorizedError: CategorizedError = Object.assign(
      new Error(error?.message || 'Unknown error'),
      {
        category: defaultCategory,
        originalError: error,
        retryable: true,
      }
    );

    // Analyze error to determine category
    if (error?.message?.includes('Failed to fetch') || error?.message?.includes('ECONNREFUSED')) {
      categorizedError.category = ErrorCategory.NETWORK_ERROR;
    } else if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
      categorizedError.category = ErrorCategory.AUTH_ERROR;
      categorizedError.retryable = false;
    } else if (error?.message?.includes('timeout')) {
      categorizedError.category = ErrorCategory.TIMEOUT_ERROR;
    }

    // Add status code if available
    if (additionalData?.statusCode) {
      categorizedError.statusCode = additionalData.statusCode;
    }

    return categorizedError;
  }

  // State management helpers
  private updateConnectionState(subscriptionId: string, state: ConnectionState): void {
    this.connectionStates.set(subscriptionId, state);
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.state = state;
    }
  }

  private updateLastError(subscriptionId: string, error: CategorizedError): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.lastError = error;
    }
  }

  // Logging helper
  private log(level: 'verbose' | 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    if (!this.options.debug?.enabled) {
      return;
    }

    const logLevels = { verbose: 0, debug: 1, info: 2, warn: 3, error: 4 };
    const configuredLevel = logLevels[this.options.debug.logLevel || 'info'];
    const messageLevel = logLevels[level];

    if (messageLevel >= configuredLevel) {
      const logFn = level === 'error' ? console.error : 
                    level === 'warn' ? console.warn : 
                    console.log;
      
      logFn(`[SseLink] ${message}`, data || '');
    }
  }

  // Public API for connection management
  public getConnectionState(subscriptionId: string): ConnectionState {
    return this.connectionStates.get(subscriptionId) || ConnectionState.DISCONNECTED;
  }

  public getActiveSubscriptions(): Array<{
    id: string;
    operationName?: string;
    state: ConnectionState;
    reconnectAttempts: number;
    lastError?: Error;
  }> {
    return Array.from(this.subscriptions.entries()).map(([id, subscription]) => ({
      id,
      operationName: subscription.operationName,
      state: subscription.state,
      reconnectAttempts: subscription.reconnectAttempts,
      lastError: subscription.lastError,
    }));
  }

  /**
   * Dispose of all subscriptions and close all connections
   */
  public dispose(): void {
    this.log('info', 'Disposing all subscriptions');
    
    // Clean up all active subscriptions
    for (const [subscriptionId, subscription] of this.subscriptions) {
      subscription.observer.complete();
      this.cleanupSubscription(subscriptionId);
    }
    
    this.subscriptions.clear();
    this.connectionStates.clear();
  }
}

/**
 * Helper function to create an SseLink with sensible defaults
 */
export function createSseLink(options: SseLinkOptions): SseLink {
  return new SseLink({
    credentials: 'include',
    retry: {
      attempts: 5,
      delay: 1000,
    },
    ...options,
  });
}