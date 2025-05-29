# UI Components CLAUDE.md

## Overview
Production-ready React dashboard for the metaGOTHIC framework with **fully operational live GitHub API integration** at http://localhost:3001. Features 100% real data from GitHub repositories, resolved browser compatibility issues, and comprehensive error handling. No mock fallbacks in production.

## Production Status ✅
- **Live GitHub API Integration**: 100% real data - no mock fallbacks in production
- **GitHub Token Working**: Configured and authenticated with real repository access
- **Real Workflow Data**: Live workflow runs displaying actual repository data
- **Browser Compatibility**: Resolved all Node.js compatibility issues
- **Date Parsing Fixed**: All workflow timestamps display correctly
- **Debug Logging**: Temporarily enabled for verification
- **Comprehensive Error Handling**: ApiError component and refined error boundaries
- **Browser-Compatible Utilities**: Logger and cache with console/memory fallbacks
- **Production Dashboard**: Fully operational at http://localhost:3001 with live data
- **Token Validation**: Visual indicators and authentication management

## Architecture

### Tech Stack
- **React 18** with TypeScript
- **Vite** for development and building  
- **TanStack Query** for data fetching and caching
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Real GitHub API** integration
- **Browser-compatible** utilities

### Component Structure
```
src/
├── components/
│   ├── HealthDashboard/      # Main health monitoring interface
│   │   ├── index.tsx         # Dashboard container
│   │   ├── RepositoryCard.tsx # Individual repo status card
│   │   ├── MetricsOverview.tsx # Summary metrics display
│   │   └── WorkflowList.tsx  # Recent workflow runs
│   ├── PipelineControl/      # CI/CD control interface
│   │   ├── index.tsx         # Control center container
│   │   ├── WorkflowCard.tsx  # Workflow trigger interface
│   │   └── PublishModal.tsx  # Package publishing dialog
│   ├── ErrorBoundary/        # Comprehensive error handling
│   │   ├── GitHubErrorBoundary.tsx # GitHub-specific errors
│   │   ├── QueryErrorBoundary.tsx  # TanStack Query errors
│   │   └── examples.tsx      # Error boundary examples
│   ├── Skeleton/             # Loading states and skeletons
│   │   ├── LoadingTimeout.tsx # Timeout handling
│   │   ├── Shimmer.tsx       # Shimmer effects
│   │   └── various skeletons # Component-specific skeletons
│   ├── TokenValidation/      # GitHub token management
│   │   ├── GitHubTokenBanner.tsx # Token status banner
│   │   └── TokenStatusIndicator.tsx # Visual indicators
│   └── ApiError.tsx          # User-friendly error display
├── services/
│   ├── githubService.ts      # Real GitHub API integration
│   ├── githubServiceMock.ts  # Mock for development
│   └── api.ts               # Unified API layer
├── utils/
│   ├── logger.ts            # Browser-compatible logger
│   └── cache.ts             # Memory-based cache
├── contexts/
│   └── TokenValidationContext.tsx # Token state management
├── hooks/
│   └── useGitHubToken.ts    # Token validation hook
├── types/
│   └── index.ts             # TypeScript type definitions
├── App.tsx                  # Main app component with routing
└── main.tsx                 # React entry point
```

## Key Features

### Health Monitoring Dashboard ✅
- **Real-time package health status** from GitHub API
- **Build and test coverage metrics** with visual indicators
- **Dependency health tracking** across repositories
- **Recent workflow activity** with detailed status
- **Error state handling** with user-friendly messages

### Pipeline Control Center ✅
- **One-click workflow triggers** via GitHub API
- **Package publishing interface** with validation
- **Repository filtering** and search functionality
- **Batch operations** for multiple repositories

### Production-Ready Error Handling ✅
- **ApiError component** for user-friendly error display
- **GitHub-specific error boundaries** with context
- **Query error boundaries** with retry functionality
- **Loading timeouts** and graceful degradation
- **Token validation** with visual feedback

### Browser-Compatible Utilities ✅
- **Logger**: Console-based logging with structured output
- **Cache**: Memory-based caching with TTL support
- **Token Management**: Secure GitHub token handling

## Development

### Running the Dashboard
```bash
npm run dev     # Start dev server on http://localhost:3001
npm run build   # Build for production
npm run preview # Preview production build
```

### Environment Setup
Create `.env.local`:
```env
VITE_GITHUB_TOKEN=your_github_token_here
```

### Testing
```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm run test:coverage # With coverage report
```

### Current Test Coverage ✅
- **20+ tests passing** with comprehensive coverage
- **Components**: App, HealthDashboard, ErrorBoundaries, Skeletons
- **Services**: Real GitHub API integration tests
- **Hooks**: Token validation and management
- **Integration tests**: End-to-end API workflows
- **Error boundary tests**: Edge case handling

## API Integration ✅

**Live GitHub API Integration** ✅:
- ✅ **GitHub REST API** with 100% real data integration
- ✅ **GitHub token configured and working** with real repository access
- ✅ **Live workflow runs** displaying actual data from repositories
- ✅ **Browser compatibility** with resolved Node.js issues
- ✅ **Date parsing resolved** - all timestamps display correctly
- ✅ **Authentication** via GitHub personal access tokens
- ✅ **Rate limiting** awareness and proper caching
- ✅ **Error handling** with user-friendly messages
- ✅ **Token validation** with scope verification
- ✅ **Debug logging enabled** for verification (temporary)

**Future enhancements**:
- WebSocket for real-time updates
- GitHub OAuth for user authentication
- GraphQL API for more efficient queries

## Styling

Uses Tailwind CSS with:
- Dark mode support (class-based)
- Responsive design
- Custom Gothic color palette
- Consistent spacing and sizing

## State Management ✅

- **TanStack Query** for server state with caching
- **React Context** for token validation state
- **Local storage** for token persistence
- **Memory cache** for API response caching
- **Error state** management in error boundaries

## Performance Considerations ✅

- **Query caching** with 5-minute stale time
- **Background refetching** for fresh data
- **Optimistic updates** for immediate feedback
- **Loading skeletons** for better perceived performance
- **Memory-efficient** component rendering
- **Browser-compatible** utilities with minimal overhead
- **Rate limiting** awareness to avoid API throttling

## Completed Features ✅

1. **✅ Live GitHub API Integration**
   - 100% real data integration - no mock fallbacks in production
   - GitHub token configured and working with real repository access
   - Live workflow runs displaying actual data from repositories
   - Browser compatibility with resolved Node.js issues
   - Date parsing resolved - all timestamps display correctly
   - Debug logging enabled for verification (temporary)
   - Token-based authentication with validation
   - Comprehensive error boundaries and handling

2. **✅ Production-Ready Dashboard**
   - Fully operational at http://localhost:3001
   - Real-time data from GitHub API with no mock fallbacks
   - Recent workflow runs display live data from repositories
   - All date parsing and workflow display issues resolved
   - User-friendly error states and recovery
   - Loading states and skeleton components

3. **✅ Error Handling System**
   - ApiError component for user feedback
   - GitHub-specific error boundaries
   - Query error boundaries with retry
   - Token validation with visual indicators

## Future Enhancements

1. **Enhanced Features**
   - Dependency graph visualization
   - Performance metrics charts
   - Automated issue creation
   - Integration with Claude AI

2. **UI Improvements**
   - More detailed workflow logs
   - Customizable dashboard layouts
   - Export functionality
   - Keyboard shortcuts

3. **Advanced Integration**
   - WebSocket for real-time updates
   - GitHub OAuth for user authentication
   - GraphQL API for efficient queries

## Common Issues

### Dev Server Not Loading
- Check if port 3001 is available: `lsof -i :3001`
- Ensure all dependencies installed: `npm install`
- Clear Vite cache: `rm -rf node_modules/.vite`
- Verify environment variables in `.env.local`

### GitHub API Issues
- **Token missing**: Check `VITE_GITHUB_TOKEN` environment variable
- **Rate limiting**: Use token validation banner to check status
- **Scope errors**: Ensure token has `repo` and `workflow` permissions
- **CORS issues**: API calls are browser-compatible and properly configured

### Error Boundary Issues
- Errors are caught and displayed with user-friendly messages
- Check browser console for detailed error information
- Use ApiError component for consistent error display
- Token validation provides real-time authentication status

### Performance Issues
- Query caching reduces API calls automatically
- Loading skeletons improve perceived performance
- Background refetching keeps data fresh
- Memory cache prevents redundant API requests

### Testing Issues
- Run `npm run test:coverage` for detailed coverage report
- Integration tests cover real API interactions
- Mock services available for isolated testing
- Error boundary tests ensure proper error handling