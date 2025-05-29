# GitHub Token Validation System

A comprehensive token validation and error display system for the metaGOTHIC dashboard that provides real-time GitHub token status monitoring and user-friendly error messages.

## Features

- **Automatic Token Validation**: Validates GitHub token on app startup and provides real-time status
- **Comprehensive Error Detection**: Detects missing tokens, invalid formats, insufficient permissions, rate limiting, and network issues
- **Visual Status Indicators**: Header status indicator with token health and rate limit information
- **Prominent Error Banners**: Full-screen error messages with specific setup instructions
- **Integration with Error Boundary**: Works seamlessly with existing error handling system
- **Context Provider**: Centralized state management for token validation across the app

## Components

### `useGitHubToken` Hook

Custom hook that handles all token validation logic:

```typescript
const { status, error, isValidating, retryValidation } = useGitHubToken();
```

**Returns:**
- `status`: Current token validation status with detailed information
- `error`: Specific error details if validation fails
- `isValidating`: Loading state during validation
- `retryValidation`: Function to retry validation

### `TokenStatusIndicator`

Compact status indicator for the dashboard header:

```tsx
<TokenStatusIndicator 
  status={status}
  isValidating={isValidating}
  onRefresh={retryValidation}
  showDetails={true}
/>
```

**Features:**
- Visual icons for different states (valid, invalid, missing, validating)
- User information and rate limit display
- Rate limit warnings when approaching limits
- Refresh button for manual validation

### `GitHubTokenBanner`

Prominent error banner for token validation issues:

```tsx
<GitHubTokenBanner 
  error={error}
  onRetry={retryValidation}
  onDismiss={dismissError}
  isRetrying={isValidating}
/>
```

**Features:**
- Specific error messages for different issue types
- Step-by-step setup instructions
- Direct links to GitHub token creation
- Retry and dismiss functionality

### `TokenValidationProvider`

Context provider for centralized token validation state:

```tsx
<TokenValidationProvider>
  <App />
</TokenValidationProvider>
```

## Error Types

The system detects and provides specific guidance for these error types:

### 1. Missing Token (`missing`)
- **Cause**: `VITE_GITHUB_TOKEN` environment variable not set
- **Display**: Red error with setup instructions
- **Actions**: Links to create new token, step-by-step guide

### 2. Invalid Token (`invalid`)
- **Cause**: Token format incorrect or authentication failed
- **Display**: Red error with troubleshooting tips
- **Actions**: Links to create new token, format validation

### 3. Insufficient Scopes (`insufficient_scopes`)
- **Cause**: Token missing required `repo` or `workflow` scopes
- **Display**: Yellow warning with scope requirements
- **Actions**: Links to update token permissions

### 4. Expired/Rate Limited (`expired`)
- **Cause**: Token expired or rate limit exceeded
- **Display**: Orange warning with rate limit info
- **Actions**: Links to token settings, automatic retry

### 5. Network Error (`network_error`)
- **Cause**: Cannot reach GitHub API
- **Display**: Blue info with connection troubleshooting
- **Actions**: Retry functionality, connection guidance

## Usage

### Basic Integration

```typescript
import { TokenValidationProvider, useTokenValidation } from '@/contexts';
import { GitHubTokenBanner, TokenStatusIndicator } from '@/components/TokenValidation';

function App() {
  return (
    <TokenValidationProvider>
      <DashboardContent />
    </TokenValidationProvider>
  );
}

function Navigation() {
  const { status, isValidating, retryValidation } = useTokenValidation();
  
  return (
    <nav>
      <h1>metaGOTHIC</h1>
      <TokenStatusIndicator 
        status={status}
        isValidating={isValidating}
        onRefresh={retryValidation}
        showDetails={true}
      />
    </nav>
  );
}

function DashboardContent() {
  const { error, isValidating, retryValidation, dismissError, isDismissed } = useTokenValidation();
  
  return (
    <div>
      {error && !isDismissed && (
        <GitHubTokenBanner 
          error={error}
          onRetry={retryValidation}
          onDismiss={dismissError}
          isRetrying={isValidating}
        />
      )}
      <Routes>
        {/* Your routes */}
      </Routes>
    </div>
  );
}
```

### Environment Setup

The system requires a GitHub Personal Access Token with specific scopes:

```bash
# .env file
VITE_GITHUB_TOKEN=ghp_your_token_here
```

**Required Token Scopes:**
- `repo` - Full access to repositories
- `workflow` - Access to GitHub Actions workflows

### Token Creation Steps

1. Go to [GitHub Settings → Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Set description: "metaGOTHIC Dashboard"
4. Select scopes: `repo`, `workflow`
5. Generate and copy the token
6. Add to your `.env` file as `VITE_GITHUB_TOKEN`
7. Restart your development server

## Status Information

The token status includes detailed information when valid:

```typescript
interface GitHubTokenStatus {
  isValid: boolean;
  isPresent: boolean;
  hasRequiredScopes: boolean;
  tokenInfo?: {
    scopes: string[];           // Available token scopes
    rateLimit: {
      remaining: number;        // Requests remaining
      limit: number;           // Total request limit
      resetTime: Date;         // When limit resets
    };
    user: {
      login: string;           // GitHub username
      name: string;            // Display name
    };
  };
}
```

## Integration with Error Boundary

The token validation system works with the existing `GitHubErrorBoundary`:

- Catches token-related errors from API calls
- Provides enhanced error messages with token context
- Offers recovery options and setup guidance
- Maintains app stability during token issues

## Testing

The system includes comprehensive tests covering all error scenarios:

```bash
npm test useGitHubToken.test.ts
```

Test coverage includes:
- Missing token detection
- Invalid format validation
- Successful authentication
- Scope verification
- Network error handling
- Rate limit detection

## Best Practices

1. **Environment Variables**: Never commit tokens to version control
2. **Scope Minimization**: Only request required scopes (`repo`, `workflow`)
3. **Error Handling**: Always provide user-friendly error messages
4. **Rate Limiting**: Monitor and display rate limit status
5. **Security**: Use fine-grained tokens when possible
6. **User Experience**: Provide clear setup instructions and recovery options

## Troubleshooting

### Common Issues

1. **Token Not Working**: Check format, ensure it starts with `ghp_` or `ghs_`
2. **Permission Denied**: Verify token has `repo` and `workflow` scopes
3. **Rate Limited**: Wait for reset time or use token with higher limits
4. **Network Errors**: Check internet connection and GitHub status

### Debug Mode

Enable debug logging for token validation:

```javascript
// In browser console
localStorage.setItem('debug', 'GitHubTokenValidation');
```

This will show detailed validation steps and API responses in the console.