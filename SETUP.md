# metaGOTHIC UI Components Setup Guide

## Overview
The metaGOTHIC UI Components package provides a React dashboard for monitoring and controlling the metaGOTHIC framework. It can operate in two modes:

1. **Mock Mode** (default): Uses mock data for demonstration
2. **GitHub Integration Mode**: Connects to real GitHub APIs for live data

## Quick Start (Mock Mode)

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to http://localhost:3000
```

## GitHub Integration Setup

To enable real GitHub API integration with live data:

### 1. Create GitHub Personal Access Token

1. Go to [GitHub Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a descriptive name: "metaGOTHIC Dashboard"
4. Select the following scopes:
   - `repo` - Full control of private repositories
   - `workflow` - Update GitHub Action workflows
   - `read:packages` - Download packages from GitHub Package Registry
   - `read:org` - Read org and team membership, read org projects

### 2. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your GitHub token:
   ```bash
   VITE_GITHUB_TOKEN=ghp_your_token_here
   ```

### 3. Restart Development Server

```bash
npm run dev
```

You should see "✅ Using real GitHub API" in the browser console if configured correctly.

## Features

### Health Monitoring Dashboard
- Real-time repository status for all metaGOTHIC packages
- Build status and test coverage metrics
- Dependency health tracking
- Recent workflow activity

### Pipeline Control Center
- Trigger workflows with one click
- Publish packages with version control
- Cancel running workflows
- Monitor deployment progress

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm test             # Run tests
npm test:coverage    # Run tests with coverage
npm run typecheck    # Type check without building
npm run lint         # Lint code
```

### Project Structure

```
src/
├── components/
│   ├── HealthDashboard/      # Main monitoring interface
│   └── PipelineControl/      # CI/CD control interface
├── services/
│   ├── api.ts               # API service layer with fallback
│   └── githubService.ts     # Real GitHub API integration
├── types/
│   └── index.ts             # TypeScript definitions
└── App.tsx                  # Main application
```

### Testing

The package includes comprehensive tests:
- Component tests with React Testing Library
- Service layer tests with mocked GitHub API
- Integration tests for complete workflows

```bash
# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm run test:coverage
```

## Troubleshooting

### "GitHub token not configured" Message
- Check that `.env.local` exists and contains `VITE_GITHUB_TOKEN`
- Verify the token has the correct scopes
- Restart the development server after adding the token

### 401 Unauthorized Errors
- Token may be invalid or expired
- Check that the token has the required scopes
- Verify the token is correctly formatted in `.env.local`

### Rate Limit Errors
- GitHub API has rate limits (5000 requests/hour for authenticated users)
- The dashboard implements automatic retry with exponential backoff
- Consider adding Redis caching for production use

### Build Errors
- Run `npm run typecheck` to identify TypeScript issues
- Check that all dependencies are installed: `npm install`
- Clear node_modules and reinstall if needed

## Production Deployment

### Environment Variables
Set these in your production environment:

```bash
VITE_GITHUB_TOKEN=your_production_token
VITE_API_URL=https://your-api-domain.com/api
```

### Security Considerations
- Never commit `.env.local` to version control
- Use different GitHub tokens for development and production
- Consider using GitHub Apps for production authentication
- Implement proper CORS settings for your API

### Performance Optimizations
- Enable Redis caching by updating `githubService.ts`
- Implement service worker for offline functionality
- Consider using GitHub webhooks for real-time updates

## Next Steps

1. **Real-time Updates**: Add WebSocket support for live data
2. **Enhanced Caching**: Implement Redis caching layer
3. **Advanced Features**: Dependency graphs, performance analytics
4. **Authentication**: Add user authentication for multi-user support

## Related Documentation
- [metaGOTHIC CLAUDE.md](../../CLAUDE.md) - Framework overview
- [ADR-015](../../../../docs/ADR-015-github-api-hybrid-strategy.md) - GitHub API strategy
- [Package Catalog](../../../../docs/package-catalog.md) - All package details