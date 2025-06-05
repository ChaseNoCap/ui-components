# @chasenocap/ui-components

[![Version](https://img.shields.io/npm/v/@chasenocap/ui-components.svg)](https://github.com/ChaseNoCap/ui-components)
[![Build Status](https://github.com/ChaseNoCap/ui-components/workflows/CI/badge.svg)](https://github.com/ChaseNoCap/ui-components/actions)

Production-ready React dashboard for the metaGOTHIC framework with **fully operational live GitHub API integration** at http://localhost:3001. Features real-time health monitoring, CI/CD pipeline control, and 100% live data from GitHub repositories with no mock fallbacks.

## 🚀 Quick Start

### **Essential: Start the Federation Gateway**

The dashboard uses GraphQL Federation v2 and requires the gateway to be running:

```bash
# Terminal 1: Start the federation gateway and all services
cd ../../ # Go to meta-gothic-framework root
npm run start:federation

# Terminal 2: Start the React dashboard  
cd packages/ui-components
npm run dev
```

**Dashboard URL**: http://localhost:3001

> ⚠️ **Important**: The federation gateway provides:
> - Unified GraphQL endpoint for all services
> - Real-time git operations through Repo Agent Service
> - AI-powered features through Claude Service
> - GitHub data through GitHub Mesh Service

### Environment Setup
Create `.env.local`:
```env
VITE_GITHUB_TOKEN=your_github_token_here
VITE_GATEWAY_URL=http://localhost:3000/graphql
VITE_GATEWAY_WS_URL=ws://localhost:3000/graphql
```

## 🚀 Production Features

### GraphQL Federation v2 Integration ✅
- **Unified GraphQL gateway** - single endpoint for all operations
- **100% GraphQL operations** - no REST API calls
- **Federated services** providing specialized functionality:
  - Claude Service for AI operations
  - Repo Agent Service for git operations
  - GitHub Mesh Service for GitHub data
- **Real-time subscriptions** through WebSocket support
- **Type-safe operations** with generated TypeScript types
- **Automatic service discovery** and schema composition

### Comprehensive Error Handling
- **ApiError component** for user-friendly error display
- **Refined error boundaries** with GitHub-specific error handling
- **Query error boundaries** with retry functionality
- **Loading timeouts** and graceful degradation

### Production Dashboard ✅
- **Fully operational at**: http://localhost:3001
- **Live GitHub data integration** - real workflow runs and repository status
- **Recent workflow runs** display actual data from repositories
- **Date parsing resolved** - all workflow timestamps display correctly
- **Debug logging enabled** for verification (temporarily)
- **Responsive design** with Tailwind CSS
- **Performance optimized** with proper caching

## 🏗️ Architecture

### Tech Stack
- **React 18** with TypeScript
- **Vite** for development and building  
- **TanStack Query** for data fetching and caching
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Real GitHub API** integration

### Browser-Compatible Utilities
- **Logger**: Browser-compatible logging with console fallback
- **Cache**: Memory-based caching with TTL support
- **Error Handling**: Comprehensive error boundaries and user feedback

## 🎯 Key Components

### Health Dashboard
```tsx
import { HealthDashboard } from '@chasenocap/ui-components';

// Real-time monitoring with GitHub API
<HealthDashboard />
```

### Pipeline Control
```tsx
import { PipelineControl } from '@chasenocap/ui-components';

// CI/CD workflow management
<PipelineControl />
```

### Error Handling
```tsx
import { GitHubErrorBoundary, ApiError } from '@chasenocap/ui-components';

// Comprehensive error management
<GitHubErrorBoundary>
  <YourComponent />
</GitHubErrorBoundary>
```

## 📦 Installation & Building

### Package Installation
```bash
npm install @chasenocap/ui-components
```

### Build Commands
```bash
npm run build   # Production build
npm run preview # Preview production build
npm run typecheck # TypeScript validation
npm run lint    # Code linting
```

## 🧪 Testing

### Test Coverage
- **20+ tests** with comprehensive coverage
- **Integration tests** for GitHub API
- **Component tests** for all major features
- **Error boundary tests** for edge cases

```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm run test:coverage # Coverage report
```

## 📊 Features

### Health Monitoring
- ✅ **Real-time repository status** from GitHub API
- ✅ **Workflow run tracking** with detailed status
- ✅ **Build and test metrics** with visual indicators
- ✅ **Error state handling** with user-friendly messages

### Pipeline Control
- ✅ **One-click workflow triggers** via GitHub API
- ✅ **Package publishing interface** with validation
- ✅ **Repository filtering** and search
- ✅ **Batch operations** for multiple repositories

### AI-Powered Tools ✨
- ✅ **Real-time git status detection** across all packages
- ✅ **Claude Code integration** for intelligent commit message generation
- ✅ **Live change analysis** with no static/cached data
- ✅ **Automated workflow suggestions** based on actual file changes

### Production Ready
- ✅ **Comprehensive error handling** with graceful degradation
- ✅ **Loading states** and skeleton components
- ✅ **Token validation** with visual feedback
- ✅ **Rate limiting** awareness and caching
- ✅ **Responsive design** for all screen sizes

## 🔧 API Integration

### GitHub Service
```typescript
import { gitHubService } from '@chasenocap/ui-components';

// Real GitHub API calls with error handling
const repositories = await gitHubService.getRepositories();
const workflows = await gitHubService.getWorkflowRuns(owner, repo);
```

### Authentication
- **Token validation** with visual indicators
- **Scope verification** for required permissions
- **Error recovery** with clear user guidance

## 🎨 Styling

### Tailwind CSS Integration
- **Dark mode support** with system preference detection
- **Custom Gothic color palette** for branding
- **Responsive breakpoints** for all devices
- **Component variants** for different states

### Design System
- **Consistent spacing** using Tailwind scale
- **Typography hierarchy** with clear visual hierarchy
- **Icon system** using Lucide React
- **Loading patterns** with shimmer effects

## 🚀 Performance

### Optimization Features
- **Query caching** with 5-minute stale time
- **Background refetching** for fresh data
- **Optimistic updates** for immediate feedback
- **Memory-efficient** component rendering

### Browser Compatibility
- **Modern browsers** (Chrome, Firefox, Safari, Edge)
- **ES2020+ features** with proper polyfills
- **Browser-compatible** logging and caching
- **Progressive enhancement** for older browsers

## 🔍 Troubleshooting

### Common Issues

#### Dashboard Not Loading
```bash
# Check port availability
lsof -i :3001

# Clear cache and restart
rm -rf node_modules/.vite
npm run dev
```

#### GitHub API Errors
- Verify `VITE_GITHUB_TOKEN` is set correctly
- Check token permissions (repo, workflow scopes)
- Review rate limiting in browser console
- Use token validation banner for diagnostics

#### Build Issues
```bash
npm run typecheck  # Check TypeScript errors
npm run lint       # Check ESLint issues
npm run build      # Full production build
```

## 📈 Development Status

### Current Implementation ✅
- ✅ **Production-ready dashboard** fully operational at http://localhost:3001
- ✅ **Live GitHub API integration** - 100% real data, no mock fallbacks
- ✅ **GitHub token configured and working** with real repository data
- ✅ **Recent workflow runs** displaying live data from repositories
- ✅ **Browser-compatible implementation** with resolved Node.js issues
- ✅ **Date parsing resolved** - all timestamps display correctly
- ✅ **Debug logging enabled** for verification (temporary)
- ✅ **Browser-compatible utilities** (logger, cache)
- ✅ **Comprehensive test suite** with 20+ tests
- ✅ **Error boundaries** and user-friendly error states

### Recent Achievements ✅
- **Live GitHub Integration**: 100% real data - no mock fallbacks
- **GitHub Token Working**: Configured and authenticated successfully
- **Real Workflow Data**: Live workflow runs from actual repositories
- **Browser Compatibility**: Resolved all Node.js compatibility issues
- **Date Parsing Fixed**: All workflow timestamps display correctly
- **Production Dashboard**: Fully operational at http://localhost:3001
- **Debug Verification**: Temporary logging enabled for data validation
- **Error Handling**: Comprehensive ApiError component and boundaries
- **Token Validation**: Visual indicators and authentication management
- **Performance**: Optimized caching and loading states

## 🤝 Contributing

### Development Workflow
1. **Clone repository** with submodules
2. **Install dependencies**: `npm install`
3. **Set up environment**: Copy `.env.example` to `.env.local`
4. **Start development**: `npm run dev`
5. **Run tests**: `npm test`

### Code Standards
- **TypeScript strict mode** enabled
- **ESLint + Prettier** for code formatting
- **Component testing** required for new features
- **Error handling** must be comprehensive
- **Documentation** updates for new features

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Related Packages

- **[@chasenocap/cache](../cache)**: Caching utilities
- **[@chasenocap/logger](../logger)**: Logging infrastructure  
- **[@chasenocap/github-graphql-client](../github-graphql-client)**: GitHub API client

---

**metaGOTHIC Framework** - AI-guided development infrastructure