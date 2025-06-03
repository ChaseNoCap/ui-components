import { ApolloError } from '@apollo/client';
import { toast } from './toast';

export interface GraphQLErrorDetail {
  type: 'TYPE_MISMATCH' | 'SERVICE_UNAVAILABLE' | 'TIMEOUT' | 'CONNECTION_ERROR' | 'OFFLINE' | 'UNKNOWN';
  message: string;
  suggestions?: string[];
  operation?: string;
  service?: string;
}

/**
 * Parse Apollo GraphQL errors and return user-friendly messages
 */
export function parseGraphQLError(error: ApolloError): GraphQLErrorDetail {
  // Check for federation type mismatch errors
  if (error.graphQLErrors?.length > 0) {
    const firstError = error.graphQLErrors[0];
    
    if (firstError.extensions?.code === 'GRAPHQL_VALIDATION_FAILED') {
      const typeMatch = firstError.message.match(/Unknown type "([^"]+)"/);
      const suggestedTypes = firstError.message.match(/Did you mean "([^"]+)"/g);
      
      return {
        type: 'TYPE_MISMATCH',
        message: `Schema validation error: Type '${typeMatch?.[1] || 'unknown'}' not found.`,
        suggestions: suggestedTypes?.map(s => s.replace(/Did you mean "|"/g, '')),
        operation: error.operation?.operationName
      };
    }
    
    if (firstError.extensions?.code === 'SERVICE_UNAVAILABLE') {
      return {
        type: 'SERVICE_UNAVAILABLE',
        message: `Service '${firstError.extensions.service || 'GraphQL'}' is currently unavailable.`,
        service: firstError.extensions.service as string,
        operation: error.operation?.operationName
      };
    }
  }
  
  // Check for network errors
  if (error.networkError) {
    const message = error.networkError.message || '';
    
    if (message.includes('timeout')) {
      return {
        type: 'TIMEOUT',
        message: 'The request timed out. The server might be under heavy load.',
        operation: error.operation?.operationName
      };
    }
    
    if (message.includes('ECONNREFUSED')) {
      return {
        type: 'CONNECTION_ERROR',
        message: 'Cannot connect to the GraphQL server. Please check if the server is running.',
        operation: error.operation?.operationName
      };
    }
    
    if (!navigator.onLine) {
      return {
        type: 'OFFLINE',
        message: 'You are currently offline. Please check your internet connection.',
        operation: error.operation?.operationName
      };
    }
  }
  
  // Default error
  return {
    type: 'UNKNOWN',
    message: error.message || 'An unexpected error occurred.',
    operation: error.operation?.operationName
  };
}

/**
 * Show user-friendly error toast based on GraphQL error
 */
export function showGraphQLError(error: ApolloError): void {
  const errorDetail = parseGraphQLError(error);
  
  switch (errorDetail.type) {
    case 'TYPE_MISMATCH':
      toast.error(
        `${errorDetail.message}${
          errorDetail.suggestions 
            ? `\n\nDid you mean: ${errorDetail.suggestions.join(', ')}?`
            : ''
        }`
      );
      break;
      
    case 'SERVICE_UNAVAILABLE':
      toast.error(errorDetail.message, {
        action: {
          label: 'Retry',
          onClick: () => window.location.reload()
        }
      });
      break;
      
    case 'TIMEOUT':
      toast.error(errorDetail.message, {
        duration: 5000
      });
      break;
      
    case 'CONNECTION_ERROR':
      toast.error(errorDetail.message, {
        action: {
          label: 'Check Status',
          onClick: () => window.open('/health', '_blank')
        }
      });
      break;
      
    case 'OFFLINE':
      toast.error(errorDetail.message, {
        duration: Infinity, // Keep showing until online
        id: 'offline-error' // Prevent duplicates
      });
      break;
      
    default:
      toast.error(errorDetail.message);
  }
}

/**
 * Setup global error event listeners
 */
export function setupGraphQLErrorListeners(): void {
  // Listen for federation errors
  window.addEventListener('graphql:federation-error', (event: CustomEvent) => {
    const { invalidType, suggestions, operation } = event.detail;
    
    toast.error(
      `Federation type error in ${operation}: '${invalidType}' not found.${
        suggestions ? `\n\nSuggested types: ${suggestions.join(', ')}` : ''
      }`,
      { duration: 8000 }
    );
  });
  
  // Listen for service errors
  window.addEventListener('graphql:service-error', (event: CustomEvent) => {
    const { service, operation } = event.detail;
    
    toast.error(
      `${service || 'GraphQL'} service unavailable${operation ? ` for ${operation}` : ''}.`,
      {
        action: {
          label: 'View Status',
          onClick: () => window.open('/health', '_blank')
        }
      }
    );
  });
  
  // Listen for timeout errors
  window.addEventListener('graphql:timeout', (event: CustomEvent) => {
    const { operation } = event.detail;
    
    toast.warning(
      `Request timed out${operation ? ` for ${operation}` : ''}. Retrying...`,
      { duration: 3000 }
    );
  });
  
  // Listen for connection errors
  window.addEventListener('graphql:connection-error', (event: CustomEvent) => {
    const { endpoint } = event.detail;
    
    toast.error(
      `Cannot connect to GraphQL server${endpoint ? ` at ${endpoint}` : ''}.`,
      {
        duration: 10000,
        action: {
          label: 'Troubleshoot',
          onClick: () => {
            console.log('GraphQL Troubleshooting:');
            console.log('1. Check if services are running: npm run start:services');
            console.log('2. Verify endpoint:', endpoint);
            console.log('3. Check browser console for CORS errors');
          }
        }
      }
    );
  });
  
  // Listen for offline events
  window.addEventListener('graphql:offline', () => {
    toast.error('You are offline. Some features may not work.', {
      id: 'offline-toast',
      duration: Infinity
    });
  });
  
  // Clear offline error when back online
  window.addEventListener('online', () => {
    toast.dismiss('offline-toast');
    toast.success('Back online!');
  });
}

/**
 * React hook to handle GraphQL errors in components
 */
export function useGraphQLErrorHandler() {
  return {
    handleError: showGraphQLError,
    parseError: parseGraphQLError
  };
}