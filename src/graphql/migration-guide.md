# UI Components REST to GraphQL Migration Guide

## Overview
This guide tracks the migration of all REST API calls to GraphQL queries/mutations through the federation gateway.

## Migration Status

### ✅ Completed
1. **GitHub Service** 
   - Created `githubServiceGraphQL.ts` using Apollo Client
   - Updated `dataFetcher.ts` to use GraphQL service
   - Created GraphQL queries in `github-operations.ts`

2. **GraphQL Queries Created**
   - GitHub operations: `github-operations.ts`
   - Git operations: `git-operations.ts`
   - Claude operations: `claude-operations.ts`

### 🚧 In Progress
1. **Git Service Migration**
   - Current: Direct fetch to `/api/git/*` endpoints
   - Target: Use GraphQL queries from `git-operations.ts`
   - Files to update:
     - `services/gitService.ts`
     - `services/toolsService.ts`
     - `services/changeReviewService.ts`

2. **Claude Service Migration**
   - Current: Direct fetch to `/api/claude/*` endpoints
   - Target: Use GraphQL queries from `claude-operations.ts`
   - Components to update:
     - `components/Tools/ManualCommit.tsx`
     - `components/Tools/AgentStatus.tsx`
     - `components/Tools/ClaudeConsole/index.tsx`

### 📋 TODO
1. Create `gitServiceGraphQL.ts` similar to `githubServiceGraphQL.ts`
2. Create `claudeServiceGraphQL.ts` for Claude operations
3. Update all components to use new GraphQL services
4. Remove all direct fetch() calls
5. Update environment variables to use GraphQL endpoint only

## REST Endpoints to GraphQL Mapping

### GitHub API
| REST Endpoint | GraphQL Operation |
|--------------|-------------------|
| `GET /repos/{owner}/{repo}/actions/runs` | `GitHub_actionsListWorkflowRunsForRepo` |
| `POST /repos/{owner}/{repo}/actions/workflows/{id}/dispatches` | `GitHub_actionsCreateWorkflowDispatch` |
| `POST /repos/{owner}/{repo}/actions/runs/{id}/cancel` | `GitHub_actionsCancelWorkflowRun` |
| `GET /repos/{owner}/{repo}/issues` | `GitHub_issuesListForRepo` |
| `GET /repos/{owner}/{repo}/pulls` | `GitHub_pullsList` |

### Git API
| REST Endpoint | GraphQL Operation |
|--------------|-------------------|
| `POST /api/git/exec` | `executeGitCommand` mutation |
| `POST /api/git/status` | `gitStatus` query |
| `GET /api/git/all-status` | `scanAllRepositories` query |
| `GET /api/git/scan-all-detailed` | `scanAllDetailed` query |
| `POST /api/git/commit` | `commitChanges` mutation |
| `POST /api/git/batch-commit` | `batchCommit` mutation |

### Claude API
| REST Endpoint | GraphQL Operation |
|--------------|-------------------|
| `POST /api/claude/generate-commit-messages` | `generateCommitMessages` mutation |
| `POST /api/claude/batch-commit-messages` | `generateBatchCommitMessages` mutation |
| `POST /api/claude/executive-summary` | `generateExecutiveSummary` mutation |
| `GET /api/claude/runs` | `agentRuns` query |
| `POST /api/claude/execute` | `executeCommand` mutation |

## Environment Variables
- Remove: `VITE_API_URL`, `VITE_GIT_API_URL`
- Keep: `VITE_GRAPHQL_URL` (pointing to federation gateway)
- Keep: `VITE_GITHUB_TOKEN` (for authentication)

## Benefits of Migration
1. **Single API endpoint** - All requests go through GraphQL gateway
2. **Consistent authentication** - Handled at gateway level
3. **Better caching** - GraphQL caching at field level
4. **Type safety** - Generated types from GraphQL schema
5. **Real-time updates** - Subscriptions for live data