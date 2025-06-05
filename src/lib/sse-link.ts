import { ApolloLink, Operation, FetchResult, Observable } from '@apollo/client/core';
import { print } from 'graphql';

/**
 * Custom SSE Link for GraphQL Yoga subscriptions
 * GraphQL Yoga handles subscriptions via Server-Sent Events using POST requests
 */
export class YogaSSELink extends ApolloLink {
  private uri: string;

  constructor(options: { uri: string }) {
    super();
    this.uri = options.uri;
  }

  public request(operation: Operation): Observable<FetchResult> | null {
    return new Observable((observer) => {
      const abortController = new AbortController();
      
      // Create the request body
      const body = JSON.stringify({
        query: print(operation.query),
        variables: operation.variables,
        operationName: operation.operationName,
      });

      // GraphQL Yoga uses POST with text/event-stream
      fetch(this.uri, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body,
        credentials: 'include',
        signal: abortController.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No response body');
          }

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              observer.complete();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            
            // Process complete SSE events
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                
                if (data) {
                  try {
                    const parsed = JSON.parse(data);
                    observer.next(parsed);
                  } catch (error) {
                    // Ignore parsing errors for now
                    console.warn('Failed to parse SSE data:', data);
                  }
                }
              } else if (line === 'event: complete') {
                observer.complete();
                return;
              }
            }
          }
        })
        .catch((error) => {
          observer.error(error);
        });

      // Cleanup function
      return () => {
        abortController.abort();
      };
    });
  }
}