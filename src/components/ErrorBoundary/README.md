# GitHub Error Boundary Components

Comprehensive error handling components for the metaGOTHIC dashboard that gracefully handle GitHub API errors with user-friendly messages and recovery options.

## Components

### GitHubErrorBoundary

A React Error Boundary specifically designed for GitHub API errors. It catches JavaScript errors in the component tree and displays context-aware error messages.

#### Features

- **Smart Error Classification**: Automatically categorizes errors into types:
  - `auth` - Authentication/authorization failures
  - `rate_limit` - API rate limiting
  - `network` - Connection/network issues  
  - `api` - GitHub server errors
  - `unknown` - Unexpected errors

- **Context-Aware Messages**: Provides specific error messages and guidance based on error type
- **Recovery Options**: Automatic retry with exponential backoff for retryable errors
- **Token Setup Guide**: Step-by-step instructions for GitHub token configuration
- **Dark Mode Support**: Consistent with dashboard theme
- **Accessibility**: Proper ARIA labels and keyboard navigation

#### Usage

```typescript
import { GitHubErrorBoundary } from '@/components/ErrorBoundary';

// Basic usage - wraps entire app
<GitHubErrorBoundary>
  <App />
</GitHubErrorBoundary>

// With error handler
<GitHubErrorBoundary onError={(error) => console.log('Error:', error)}>
  <DashboardComponent />
</GitHubErrorBoundary>

// With custom fallback
<GitHubErrorBoundary 
  fallback={(error, retry) => <CustomErrorUI error={error} onRetry={retry} />}
>
  <ComponentThatMightFail />
</GitHubErrorBoundary>
```

#### Props

```typescript
interface Props {
  children: ReactNode;
  fallback?: (error: GitHubError, retry: () => void) => ReactNode;
  onError?: (error: GitHubError) => void;
}
```

### QueryErrorBoundary  

A specialized error boundary that integrates with React Query for automatic query reset functionality.

#### Features

- **React Query Integration**: Automatically resets failed queries when retrying
- **Query-Specific Fallbacks**: Tailored error messages for data fetching failures
- **Granular Error Handling**: Can wrap individual query components

#### Usage

```typescript
import { QueryErrorBoundary } from '@/components/ErrorBoundary';

// Wrap query-dependent components
<QueryErrorBoundary>
  <RepositoryList />
</QueryErrorBoundary>

// With custom fallback
<QueryErrorBoundary fallback={CustomQueryErrorFallback}>
  <HealthMetrics />
</QueryErrorBoundary>
```

## Error Types

### GitHubError Interface

```typescript
interface GitHubError {
  status?: number;           // HTTP status code
  message: string;          // User-friendly error message
  type: 'auth' | 'network' | 'api' | 'rate_limit' | 'unknown';
  details?: string;         // Additional context
  retryable: boolean;       // Whether error can be retried
}
```

### Error Classification

| Error Type | Examples | Retryable | Recovery Actions |
|------------|----------|-----------|------------------|
| `auth` | Missing token, 401 errors | ❌ | Setup GitHub token |
| `rate_limit` | 403 with rate limit message | ✅ | Wait and retry |
| `network` | Connection timeout, fetch failures | ✅ | Check connection, retry |
| `api` | 500, 502, 503 server errors | ✅ | Wait and retry |
| `unknown` | Unexpected JavaScript errors | ✅ | Reload page, contact support |

## Implementation Details

### Retry Logic

- **Exponential Backoff**: Delay increases with each retry attempt
- **Rate Limit Handling**: Special handling for GitHub rate limits
- **Maximum Retries**: Prevents infinite retry loops
- **Visual Feedback**: Loading states during retry attempts

### Token Setup Integration

For authentication errors, the component provides:

1. **Direct Link**: Pre-configured GitHub token creation URL
2. **Step-by-Step Guide**: Clear instructions for token setup
3. **Scope Requirements**: Specific permissions needed (`repo`, `workflow`)
4. **Environment Setup**: How to configure `VITE_GITHUB_TOKEN`

### Styling

- **Tailwind CSS**: Uses dashboard's existing design system
- **Color Coding**: Different colors for different error types
- **Dark Mode**: Automatic dark/light theme support
- **Responsive**: Mobile-friendly layout
- **Icons**: Lucide React icons for visual clarity

## Best Practices

### Placement Strategy

1. **App Level**: Single boundary for catastrophic failures
2. **Feature Level**: Boundaries around major sections (Health Dashboard, Pipeline Control)
3. **Component Level**: QueryErrorBoundary for data-dependent components

### Error Handling Hierarchy

```typescript
// Recommended structure
<GitHubErrorBoundary> {/* App-level boundary */}
  <App>
    <QueryErrorBoundary> {/* Feature-level boundary */}
      <HealthDashboard>
        <QueryErrorBoundary> {/* Component-level boundary */}
          <RepositoryList />
        </QueryErrorBoundary>
      </HealthDashboard>
    </QueryErrorBoundary>
  </App>
</GitHubErrorBoundary>
```

### Custom Error Handling

```typescript
// Logging integration
<GitHubErrorBoundary 
  onError={(error) => {
    analytics.track('github_error', {
      type: error.type,
      status: error.status,
      retryable: error.retryable
    });
  }}
>
  <Dashboard />
</GitHubErrorBoundary>

// Custom fallback for specific contexts
const PipelineErrorFallback = (error: GitHubError, retry: () => void) => (
  <div className="pipeline-error">
    <h3>Pipeline Control Unavailable</h3>
    <p>{error.message}</p>
    {error.retryable && (
      <button onClick={retry}>Retry Pipeline Connection</button>
    )}
  </div>
);
```

## Testing

The error boundary components include comprehensive tests covering:

- Error classification accuracy
- Retry functionality with timers
- Custom fallback integration
- onError callback invocation
- Token setup UI rendering
- Dark mode styling

Run tests with:
```bash
npm test ErrorBoundary
```

## Dependencies

- React 18+ (Error Boundaries)
- @tanstack/react-query (QueryErrorBoundary)
- Tailwind CSS (Styling)
- Lucide React (Icons)
- clsx (Conditional classes)

## Migration Guide

### From Basic Error Handling

```typescript
// Before: Manual try/catch in components
const Component = () => {
  try {
    const data = useGitHubAPI();
    return <DataDisplay data={data} />;
  } catch (error) {
    return <div>Error: {error.message}</div>;
  }
};

// After: Declarative error boundaries
<QueryErrorBoundary>
  <Component />
</QueryErrorBoundary>
```

### Adding to Existing Apps

1. Wrap your app with `GitHubErrorBoundary`
2. Add `QueryErrorBoundary` around data-fetching components
3. Configure error logging with `onError` prop
4. Customize error messages with `fallback` prop if needed