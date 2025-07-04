import { apolloClient as client } from '../lib/apollo-client';
import { gql } from '@apollo/client';
import { 
  GENERATE_COMMIT_MESSAGES_MUTATION,
  BATCH_COMMIT_MUTATION
} from '../graphql/operations';
import {
  HIERARCHICAL_COMMIT,
  HIERARCHICAL_COMMIT_AND_PUSH,
  PUSH_CHANGES
} from '../graphql/git-operations';
import type { 
  ChangeReviewReport, 
  RepositoryChangeData, 
  ScanProgress 
} from './changeReviewService';
import type { LogEntry } from '../components/LoadingStates/ProgressLog';

// GraphQL Queries
const SCAN_ALL_DETAILED = gql`
  query ServiceScanAllDetailed {
    scanAllDetailed {
      repositories {
        name
        path
        status {
          branch
          isDirty
          ahead
          behind
          hasRemote
          files {
            path
            status
            statusDescription
            isStaged
          }
          stashes {
            index
            message
            timestamp
          }
        }
        stagedDiff
        unstagedDiff
        recentCommits {
          hash
          message
          author
          authorEmail
          timestamp
        }
        remotes {
          name
          fetchUrl
          pushUrl
        }
        config {
          defaultBranch
          isBare
          isShallow
        }
      }
      statistics {
        totalRepositories
        dirtyRepositories
        totalUncommittedFiles
        totalAdditions
        totalDeletions
        changesByType {
          modified
          added
          deleted
          renamed
          untracked
        }
      }
      metadata {
        startTime
        endTime
        duration
        workspaceRoot
      }
    }
  }
`;

// Using GENERATE_COMMIT_MESSAGES_MUTATION from operations.ts

const GENERATE_EXECUTIVE_SUMMARY = gql`
  mutation ServiceGenerateExecutiveSummary($input: Claude_ExecutiveSummaryInput!) {
    generateExecutiveSummary(input: $input) {
      success
      summary
      error
      metadata {
        repositoryCount
        totalChanges
        themes {
          name
          description
          affectedRepositories
          impact
        }
        riskLevel
        suggestedActions
      }
    }
  }
`;

// Using BATCH_COMMIT_MUTATION from operations.ts

export class GraphQLChangeReviewService {
  private logEntries: LogEntry[] = [];
  private onLog?: (entry: LogEntry) => void;
  private isReviewInProgress = false;

  /**
   * Reset the review in progress flag (for error recovery)
   */
  public resetReviewState() {
    this.isReviewInProgress = false;
    this.logEntries = [];
  }

  /**
   * Add a log entry
   */
  private log(message: string, type: LogEntry['type'] = 'info') {
    const entry: LogEntry = {
      timestamp: new Date(),
      message,
      type
    };
    this.logEntries.push(entry);
    this.onLog?.(entry);
  }

  /**
   * Scan all repositories using GraphQL
   */
  async scanAllRepositories(
    onProgress?: (progress: ScanProgress) => void,
    onLogEntry?: (entry: LogEntry) => void
  ): Promise<RepositoryChangeData[]> {
    this.onLog = onLogEntry;
    try {
      // Log initial connection
      this.log('🔍 Initializing change review process...', 'progress');
      onProgress?.({
        stage: 'scanning',
        message: 'Establishing connection to repository analysis service...',
        current: 0,
        total: 100
      });

      console.log('🔍 Starting GraphQL query');
      this.log('📊 Querying all repositories for uncommitted changes...', 'info');
      onProgress?.({
        stage: 'scanning',
        message: 'Analyzing git status across all repositories...',
        current: 20,
        total: 100
      });
      
      let response;
      try {
        response = await client.query({
          query: SCAN_ALL_DETAILED,
          fetchPolicy: 'no-cache', // Bypass cache completely
          errorPolicy: 'all', // Handle partial errors
          context: {
            // Add timestamp to force fresh data
            forceFetch: true,
            timestamp: Date.now()
          }
        });
        console.log('✅ GraphQL query response:', response);
        this.log('✅ Repository scan completed successfully', 'success');
      } catch (queryError) {
        console.error('❌ GraphQL query error:', queryError);
        this.log(`GraphQL query failed: ${queryError instanceof Error ? queryError.message : 'Unknown error'}`, 'error');
        throw new Error(`GraphQL query failed: ${queryError instanceof Error ? queryError.message : String(queryError)}`);
      }

      if (!response || !response.data) {
        console.error('❌ No data in response:', response);
        throw new Error('GraphQL query returned no data');
      }

      const { data } = response;
      console.log('📊 Data received:', data);

      if (!data.scanAllDetailed) {
        console.error('❌ No scanAllDetailed in data:', data);
        throw new Error('GraphQL query did not return scanAllDetailed');
      }

      const scanReport = data.scanAllDetailed;
      
      this.log(`📁 Discovered ${scanReport.statistics.totalRepositories} repositories in the workspace`, 'info');
      this.log(`📝 Found ${scanReport.statistics.totalUncommittedFiles} files with uncommitted changes`, 'info');
      
      if (scanReport.statistics.dirtyRepositories > 0) {
        this.log(`⚠️  ${scanReport.statistics.dirtyRepositories} repositories have pending changes`, 'info');
      }
      
      onProgress?.({
        stage: 'scanning',
        message: `Analyzing changes in ${scanReport.statistics.totalRepositories} repositories...`,
        current: 60,
        total: 100
      });

      // Transform GraphQL response to match existing interface
      const totalRepos = scanReport.repositories.length;
      this.log('🔄 Processing repository change details...', 'progress');
      
      return scanReport.repositories.map((repo: any, index: number) => {
        const { name, path, status, stagedDiff, unstagedDiff, recentCommits } = repo;
        
        // Log processing of each repository with more detail
        if (status.files.length > 0) {
          const fileTypes = new Set(status.files.map((f: any) => 
            f.path.split('.').pop() || 'unknown'
          ));
          this.log(`📦 ${name}: ${status.files.length} files changed (${Array.from(fileTypes).slice(0, 3).join(', ')})`, 'info');
        }
        
        // Update progress for each repo processed
        onProgress?.({
          stage: 'scanning',
          message: `Analyzing ${name} (${index + 1}/${totalRepos})...`,
          current: 60 + Math.floor((40 * (index + 1)) / totalRepos),
          total: 100
        });
        
        // Transform file changes
        const changes = status.files.map((file: any) => ({
          file: file.path,
          status: file.status,
          staged: file.isStaged,
          unstaged: !file.isStaged
        }));

        // Only filter submodule changes for the meta repository (matching REST API behavior)
        const isMetaRepo = name === 'meta-gothic-framework';
        const submoduleChanges = isMetaRepo 
          ? changes.filter((c: any) => c.file.startsWith('packages/') && c.status === 'M')
          : [];
        const regularChanges = isMetaRepo
          ? changes.filter((c: any) => !c.file.startsWith('packages/') || c.status !== 'M')
          : changes;

        // Calculate statistics - match REST API behavior
        const statistics = {
          totalFiles: regularChanges.length,
          totalFilesWithSubmodules: changes.length,
          stagedFiles: regularChanges.filter((c: any) => c.staged).length,
          unstagedFiles: regularChanges.filter((c: any) => c.unstaged).length,
          // Match REST API: untracked files (??) are counted as additions
          additions: regularChanges.filter((c: any) => c.status === '??' || c.status === 'A').length,
          modifications: regularChanges.filter((c: any) => c.status === 'M').length,
          deletions: regularChanges.filter((c: any) => c.status === 'D').length,
          hiddenSubmoduleChanges: submoduleChanges.length
        };

        return {
          name: name,
          path: path,
          branch: {
            current: status.branch,
            tracking: '',
            ahead: status.ahead || 0,
            behind: status.behind || 0
          },
          changes: regularChanges,
          hasChanges: status.isDirty,
          needsPush: status.ahead > 0, // Repository has unpushed commits
          recentCommits: recentCommits.map((commit: any) => ({
            hash: commit.hash,
            message: commit.message,
            author: commit.author,
            date: commit.timestamp
          })),
          gitDiff: {
            staged: stagedDiff || '',
            unstaged: unstagedDiff || ''
          },
          newFileContents: {}, // TODO: Implement if needed
          statistics,
          hasHiddenSubmoduleChanges: submoduleChanges.length > 0,
          _submoduleChanges: submoduleChanges
        };
      });
    } catch (error) {
      console.error('Error scanning repositories:', error);
      if (error instanceof Error && error.message.includes('404')) {
        throw new Error('GraphQL endpoint not found. Please ensure the gateway is running on port 3000');
      }
      throw error;
    }
  }

  /**
   * Generate commit messages using parallel GraphQL mutations
   */
  async generateCommitMessages(
    repositories: RepositoryChangeData[],
    onProgress?: (progress: ScanProgress) => void
  ): Promise<RepositoryChangeData[]> {
    const reposWithChanges = repositories.filter(r => r.hasChanges);
    
    this.log(`🤖 Preparing to generate intelligent commit messages for ${reposWithChanges.length} repositories...`, 'progress');
    
    onProgress?.({
      stage: 'generating',
      message: `Analyzing code changes to craft meaningful commit messages...`,
      current: 0,
      total: reposWithChanges.length
    });
    
    if (reposWithChanges.length === 0) {
      return repositories;
    }

    try {
      // Calculate approximate token count (rough estimate: 4 chars = 1 token)
      const estimatedTokens = reposWithChanges.reduce((total, repo) => {
        const diffLength = (repo.gitDiff.staged || '').length + (repo.gitDiff.unstaged || '').length;
        return total + Math.floor(diffLength / 4);
      }, 0);
      
      this.log(`📊 Estimated token count: ${estimatedTokens.toLocaleString()}`, 'info');
      
      // If token count is too high, use file lists instead of diffs
      const useFileListsOnly = estimatedTokens > 150000;
      
      if (useFileListsOnly) {
        this.log(`⚠️ Token count exceeds 150k limit. Using file lists instead of full diffs to reduce token usage.`, 'info');
      }
      
      // Build input for GraphQL mutation matching the expected schema
      const input = {
        repositories: reposWithChanges.map(repo => ({
          path: repo.path,
          name: repo.name,
          // Use diffs only if under token limit, otherwise send summary
          diff: useFileListsOnly 
            ? `Files changed (${repo.statistics.totalFiles}):\n${repo.changes.map(c => `${c.status} ${c.file}`).join('\n')}`
            : [repo.gitDiff.staged, repo.gitDiff.unstaged].filter(d => d).join('\n\n'),
          filesChanged: repo.changes.map(c => c.file),
          recentCommits: repo.recentCommits.slice(0, 5).map(c => c.message),
          context: `Repository: ${repo.name}, Branch: ${repo.branch.current}, ${repo.statistics.totalFiles} files changed${
            useFileListsOnly ? ' (using file list mode due to large diff size)' : ''
          }`
        })),
        styleGuide: {
          format: 'conventional',
          maxLength: 72,
          includeScope: true,
          includeBody: true
        },
        globalContext: `Working on metaGOTHIC framework - ${reposWithChanges.length} repositories with changes`,
        analyzeRelationships: true
      };
      
      this.log('🚀 Sending changes to AI for commit message generation...', 'info');
      this.log(`📄 Context includes: ${input.repositories.reduce((sum, r) => sum + r.filesChanged.length, 0)} files, ${input.repositories.length} repositories`, 'info');

      // Add extended timeout for Claude CLI processing
      // Claude CLI can take up to 20 minutes for complex requests
      let response;
      try {
        this.log('🤖 Claude is analyzing your code changes. This may take up to 20 minutes for large codebases...', 'info');
        this.log('☕ Feel free to grab a coffee while Claude thinks deeply about your commits!', 'info');
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Commit message generation timed out after 25 minutes. This usually means Claude is processing a very complex request. Please try breaking it into smaller batches.'));
          }, 25 * 60 * 1000); // 25 minutes timeout (5 min buffer for 20 min Claude processing)
        });

        const mutationPromise = client.mutate({
          mutation: GENERATE_COMMIT_MESSAGES_MUTATION,
          variables: { input },
          fetchPolicy: 'no-cache' // Ensure fresh request
        });

        // Race between the mutation and the timeout
        response = await Promise.race([
          mutationPromise,
          timeoutPromise
        ]) as any;
        
        this.log('✅ Received response from AI service', 'info');
      } catch (error: any) {
        if (error.message && error.message.includes('timed out')) {
          this.log('⏰ ' + error.message, 'error');
          this.log('💡 Tip: Try selecting fewer repositories or simplifying your changes', 'info');
          throw error;
        }
        throw error;
      }

      console.log('GraphQL mutation response:', response);
      
      if (!response.data) {
        throw new Error('No data returned from mutation');
      }

      const result = response.data.generateCommitMessages;
      
      if (!result) {
        console.error('Mutation returned null result:', response);
        throw new Error('Mutation returned null result');
      }
      
      this.log(`✅ Successfully generated ${result.successCount}/${result.totalRepositories} AI-powered commit messages`, 
        result.successCount === result.totalRepositories ? 'success' : 'info');
      
      if (result.totalTokenUsage) {
        this.log(`📊 AI Analysis: ${result.totalTokenUsage.inputTokens.toLocaleString()} tokens analyzed, ${result.totalTokenUsage.outputTokens.toLocaleString()} tokens generated`, 'info');
        if (result.totalTokenUsage.estimatedCost) {
          this.log(`💵 Estimated cost: $${result.totalTokenUsage.estimatedCost.toFixed(4)}`, 'info');
        }
      }
      
      // Map results back to repositories
      let processedCount = 0;
      return repositories.map(repo => {
        const commitResult = result.results.find(
          (r: any) => r.repositoryName === repo.name || r.repositoryPath === repo.path
        );
        
        if (commitResult && commitResult.success) {
          processedCount++;
          this.log(`✓ ${repo.name}: Generated ${commitResult.commitType || 'commit'} message with ${commitResult.confidence ? Math.round(commitResult.confidence * 100) + '% confidence' : 'high confidence'}`, 'success');
          onProgress?.({
            stage: 'generating',
            message: `Created intelligent commit message for ${repo.name}`,
            current: processedCount,
            total: reposWithChanges.length
          });
          
          return {
            ...repo,
            generatedCommitMessage: commitResult.message
          };
        } else if (commitResult && !commitResult.success) {
          this.log(`✗ ${repo.name}: ${commitResult.error || 'Failed to generate'}`, 'error');
        }
        
        return repo;
      });
    } catch (error) {
      console.error('Error generating commit messages:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log(`❌ Failed to generate AI commit messages: ${errorMessage}`, 'error');
      
      // If the error is due to token limit and we haven't already tried file lists
      if (errorMessage.includes('token') && !input.repositories[0].diff.startsWith('Files changed')) {
        this.log('🔄 Retrying with file lists only to reduce token usage...', 'info');
        
        try {
          // Rebuild input with file lists only
          const retryInput = {
            ...input,
            repositories: reposWithChanges.map(repo => ({
              ...input.repositories.find(r => r.path === repo.path)!,
              diff: `Files changed (${repo.statistics.totalFiles}):\n${repo.changes.map(c => `${c.status} ${c.file}`).join('\n')}`,
              context: `Repository: ${repo.name}, Branch: ${repo.branch.current}, ${repo.statistics.totalFiles} files changed (retry with file list mode)`
            }))
          };
          
          const retryResponse = await client.mutate({
            mutation: GENERATE_COMMIT_MESSAGES_MUTATION,
            variables: { input: retryInput },
            fetchPolicy: 'no-cache'
          });
          
          if (retryResponse.data?.generateCommitMessages) {
            const result = retryResponse.data.generateCommitMessages;
            this.log(`✅ Retry successful! Generated ${result.successCount}/${result.totalRepositories} commit messages with file lists`, 'success');
            
            // Map results back to repositories
            let processedCount = 0;
            return repositories.map(repo => {
              const commitResult = result.results.find(
                (r: any) => r.repositoryName === repo.name || r.repositoryPath === repo.path
              );
              
              if (commitResult && commitResult.success) {
                processedCount++;
                this.log(`✓ ${repo.name}: Generated ${commitResult.commitType || 'commit'} message`, 'success');
                onProgress?.({
                  stage: 'generating',
                  message: `Created commit message for ${repo.name}`,
                  current: processedCount,
                  total: reposWithChanges.length
                });
                
                return {
                  ...repo,
                  generatedCommitMessage: commitResult.message
                };
              }
              
              return repo;
            });
          }
        } catch (retryError) {
          console.error('Retry with file lists also failed:', retryError);
          this.log(`❌ Retry with file lists failed: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`, 'error');
        }
      }
      
      this.log('🔄 Falling back to pattern-based commit message generation...', 'info');
      // Fallback to basic generation
      const fallbackRepos = this.generateFallbackCommitMessages(repositories, onProgress);
      this.log(`Fallback generation complete - ${fallbackRepos.filter(r => r.generatedCommitMessage).length} messages generated`, 'info');
      return fallbackRepos;
    }
  }

  /**
   * Generate executive summary using GraphQL
   */
  async generateExecutiveSummary(
    repositories: RepositoryChangeData[],
    onProgress?: (progress: ScanProgress) => void
  ): Promise<string> {
    onProgress?.({
      stage: 'summarizing',
      message: 'Synthesizing changes into executive summary...'
    });

    const reposWithMessages = repositories.filter(
      r => r.hasChanges && r.generatedCommitMessage
    );

    this.log(`📊 Analyzing ${reposWithMessages.length} repositories to create executive summary...`, 'info');
    
    if (reposWithMessages.length === 0) {
      this.log('✅ No messages to summarize', 'info');
      
      // Mark summarizing as complete even when no repos
      onProgress?.({ 
        stage: 'summarizing', 
        message: 'No changes to summarize' 
      });
      
      return 'No changes detected across any repositories.';
    }

    try {
      const input = {
        commitMessages: reposWithMessages.map(repo => ({
          repository: repo.name,
          message: repo.generatedCommitMessage!,
          stats: {
            filesChanged: repo.statistics.totalFiles,
            additions: repo.statistics.additions,
            deletions: repo.statistics.deletions
          }
        })),
        audience: 'technical team',
        maxLength: 500,
        focusAreas: ['breaking-changes', 'new-features', 'performance', 'dependencies', 'architecture'],
        includeRiskAssessment: true,
        includeRecommendations: true
      };
      
      this.log('🧠 Engaging AI to synthesize comprehensive executive summary...', 'info');
      this.log(`📝 Analyzing patterns across ${input.commitMessages.length} commit messages...`, 'info');

      // Use a Promise.race for timeout instead of AbortController
      let response;
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Executive summary generation timed out after 5 minutes'));
          }, 300000); // 5 minutes
        });

        const mutationPromise = client.mutate({
          mutation: GENERATE_EXECUTIVE_SUMMARY,
          variables: { input }
        });

        // Race between the mutation and the timeout
        response = await Promise.race([
          mutationPromise,
          timeoutPromise
        ]) as any;
        
        this.log('✅ Received response from AI service', 'info');
      } catch (error: any) {
        if (error.message && error.message.includes('timed out')) {
          this.log('⏰ Executive summary generation timed out after 5 minutes', 'error');
          throw error;
        }
        throw error;
      }

      console.log('Executive summary mutation response:', response);
      
      if (!response.data) {
        console.error('No data in response:', response);
        if (response.errors) {
          console.error('GraphQL errors:', response.errors);
          throw new Error(`GraphQL error: ${response.errors[0]?.message || 'Unknown error'}`);
        }
        throw new Error('No data returned from executive summary mutation');
      }
      
      if (!response.data.generateExecutiveSummary) {
        console.error('No generateExecutiveSummary in data:', response.data);
        throw new Error('Executive summary mutation returned null');
      }

      if (response.data.generateExecutiveSummary.success) {
        this.log('✅ Executive summary generated successfully', 'success');
        
        // Log metadata if available
        const metadata = response.data.generateExecutiveSummary.metadata;
        if (metadata) {
          if (metadata.themes && metadata.themes.length > 0) {
            this.log(`🎯 Identified ${metadata.themes.length} key themes across all changes`, 'info');
            metadata.themes.slice(0, 3).forEach((theme: any) => {
              this.log(`  • ${theme.name}: ${theme.affectedRepositories.length} repositories`, 'info');
            });
          }
          if (metadata.riskLevel) {
            const riskEmoji = metadata.riskLevel === 'HIGH' ? '🔴' : 
                              metadata.riskLevel === 'MEDIUM' ? '🟡' : '🟢';
            this.log(`${riskEmoji} Overall risk assessment: ${metadata.riskLevel}`, 'info');
          }
        }
        
        // Mark summarizing as complete
        onProgress?.({ 
          stage: 'summarizing', 
          message: 'Executive summary crafted successfully' 
        });
        
        return response.data.generateExecutiveSummary.summary;
      } else {
        const errorMsg = response.data.generateExecutiveSummary.error || 'Unknown error';
        console.warn('Failed to generate AI executive summary:', errorMsg);
        this.log(`⚠️ Executive summary returned error: ${errorMsg}`, 'error');
        this.log('🔄 Creating executive summary using pattern analysis...', 'info');
        const fallbackSummary = this.generateFallbackExecutiveSummary(repositories);
        
        // Mark summarizing as complete even for fallback
        onProgress?.({ 
          stage: 'summarizing', 
          message: 'Executive summary created using change patterns' 
        });
        
        return fallbackSummary;
      }
    } catch (error) {
      console.error('Error generating executive summary:', error);
      // Check for specific error types
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        // Clean up abort error messages
        if (errorMessage.includes('aborted') || errorMessage.includes('AbortError')) {
          errorMessage = 'Request was cancelled or timed out';
        }
      }
      this.log(`❌ Failed to generate AI executive summary: ${errorMessage}`, 'error');
      this.log('🔄 Creating executive summary using pattern analysis...', 'info');
      
      const fallbackSummary = this.generateFallbackExecutiveSummary(repositories);
      
      // Mark summarizing as complete even for errors
      onProgress?.({ 
        stage: 'summarizing', 
        message: 'Executive summary created using change analysis' 
      });
      
      return fallbackSummary;
    }
  }

  /**
   * Batch commit changes using GraphQL
   */
  async batchCommit(commits: Array<{ repoPath: string; message: string }>): Promise<any> {
    try {
      console.log('[graphqlChangeReviewService] batchCommit called with:', commits);
      
      // Use hierarchical commit for proper submodule-first ordering
      // Extract a common commit message - use the first non-submodule message or fallback
      const parentRepoCommit = commits.find(c => !c.repoPath.includes('packages/'));
      const message = parentRepoCommit?.message || commits[0]?.message || 'Update multiple repositories';
      
      const input = {
        message,
        stageAll: true
      };

      console.log('[graphqlChangeReviewService] Calling HIERARCHICAL_COMMIT with input:', input);

      const { data } = await client.mutate({
        mutation: HIERARCHICAL_COMMIT,
        variables: { input }
      });
      
      console.log('[graphqlChangeReviewService] HIERARCHICAL_COMMIT response:', data);

      // Transform hierarchical result to match expected format
      const results = [];
      
      // Add submodule results
      if (data.hierarchicalCommit.submoduleCommits) {
        data.hierarchicalCommit.submoduleCommits.forEach((commit: any) => {
          const repoName = commit.repository.split('/').pop() || commit.repository;
          results.push({
            repository: repoName,
            success: commit.success,
            commitHash: commit.commitHash,
            error: commit.error
          });
        });
      }
      
      // Add parent result
      if (data.hierarchicalCommit.parentCommit) {
        const parent = data.hierarchicalCommit.parentCommit;
        results.push({
          repository: 'meta-gothic-framework',
          success: parent.success,
          commitHash: parent.commitHash,
          error: parent.error
        });
      }

      const response = {
        success: data.hierarchicalCommit.success,
        results,
        totalRepositories: data.hierarchicalCommit.totalRepositories,
        successCount: data.hierarchicalCommit.successCount
      };
      
      console.log('[graphqlChangeReviewService] batchCommit returning:', response);
      return response;
    } catch (error) {
      console.error('[graphqlChangeReviewService] batchCommit error:', error);
      throw error;
    }
  }

  /**
   * Hierarchical commit and push - commits submodules first, then parent, then pushes all
   */
  async hierarchicalCommitAndPush(message: string): Promise<any> {
    try {
      const input = {
        message,
        stageAll: true
      };

      const { data } = await client.mutate({
        mutation: HIERARCHICAL_COMMIT_AND_PUSH,
        variables: { input }
      });

      return data.hierarchicalCommitAndPush;
    } catch (error) {
      console.error('Error with hierarchical commit and push:', error);
      throw error;
    }
  }

  /**
   * Main entry point: scan all repos and generate complete report
   */
  async performComprehensiveReview(
    onProgress?: (progress: ScanProgress) => void,
    onLogEntry?: (entry: LogEntry) => void
  ): Promise<ChangeReviewReport> {
    // Prevent concurrent reviews
    if (this.isReviewInProgress) {
      this.log('Review already in progress, skipping duplicate call', 'info');
      // Return empty report instead of throwing to handle React StrictMode better
      return {
        generatedAt: new Date(),
        repositories: [],
        statistics: {
          totalFiles: 0,
          totalAdditions: 0,
          totalDeletions: 0,
          totalModifications: 0,
          affectedPackages: []
        },
        scanTime: new Date().toISOString()
      };
    }
    
    this.isReviewInProgress = true;
    
    try {
      this.logEntries = []; // Clear previous logs
      this.onLog = onLogEntry;
      
      this.log('🎬 Starting comprehensive change review across all repositories...', 'info');
      this.log('🔍 This process will scan, analyze, and prepare intelligent summaries', 'info');
      
      // 1. Scan all repositories
      const repositories = await this.scanAllRepositories(onProgress, onLogEntry);
      
      // 2. Transition to analyzing stage
      const reposWithChanges = repositories.filter(r => r.hasChanges).length;
      this.log(`🧐 Beginning deep analysis of ${reposWithChanges} repositories with changes...`, 'progress');
      onProgress?.({
        stage: 'analyzing',
        message: `Examining code changes across ${reposWithChanges} repositories...`,
        current: 0,
        total: reposWithChanges
      });
      
      // Brief pause to show the analyzing stage
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 3. Generate commit messages using parallel GraphQL
      const reposWithMessages = await this.generateCommitMessages(repositories, onProgress);
      
      // 4. Compile final report
      const report = await this.generateChangeReport(reposWithMessages);
      
      // Log appropriate completion message based on whether changes were found
      const changedRepoCount = repositories.filter(r => r.hasChanges).length;
      if (changedRepoCount === 0) {
        this.log('✅ All repositories are clean!', 'success');
        this.log('🎯 No uncommitted changes found across any repositories', 'info');
      } else {
        this.log('🎆 Change review completed successfully!', 'success');
        this.log(`📦 Processed ${changedRepoCount} repositories with ${repositories.reduce((sum, r) => sum + (r.statistics?.totalFiles || 0), 0)} total file changes`, 'info');
      }
      
      // Mark as complete only after everything is done
      onProgress?.({
        stage: 'complete',
        message: changedRepoCount === 0 ? 'All repositories are clean!' : 'Comprehensive review completed successfully!'
      });
      
      return report;
    } catch (error) {
      console.error('Error performing comprehensive review:', error);
      throw error;
    } finally {
      this.isReviewInProgress = false;
    }
  }

  /**
   * Generate a complete change review report
   */
  private async generateChangeReport(
    repositories: RepositoryChangeData[]
  ): Promise<ChangeReviewReport> {
    const statistics = {
      totalFiles: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      totalModifications: 0,
      affectedPackages: [] as string[]
    };

    repositories.forEach(repo => {
      if (repo.hasChanges) {
        const repoStats = repo.statistics || {
          totalFiles: 0,
          additions: 0,
          deletions: 0,
          modifications: 0,
          stagedFiles: 0,
          unstagedFiles: 0
        };
        
        statistics.totalFiles += repoStats.totalFiles || 0;
        statistics.totalAdditions += repoStats.additions || 0;
        statistics.totalDeletions += repoStats.deletions || 0;
        statistics.totalModifications += repoStats.modifications || 0;
        
        if (!statistics.affectedPackages.includes(repo.name)) {
          statistics.affectedPackages.push(repo.name);
        }
      }
    });

    return {
      generatedAt: new Date(),
      repositories,
      statistics,
      scanTime: new Date().toISOString()
    };
  }

  /**
   * Fallback commit message generation - enhanced to be more descriptive
   */
  private generateFallbackCommitMessages(
    repositories: RepositoryChangeData[],
    onProgress?: (progress: ScanProgress) => void
  ): RepositoryChangeData[] {
    let processedCount = 0;
    const reposWithChanges = repositories.filter(r => r.hasChanges);
    
    return repositories.map(repo => {
      if (!repo.hasChanges) return repo;

      const stats = repo.statistics || { additions: 0, modifications: 0, deletions: 0 };
      const { additions = 0, modifications = 0, deletions = 0, totalFiles = 0 } = stats;
      
      // Analyze file changes to determine commit type and scope
      const fileTypes = new Set<string>();
      const scopes = new Set<string>();
      
      repo.changes.forEach(change => {
        const ext = change.file.split('.').pop() || '';
        fileTypes.add(ext);
        
        // Extract scope from file path
        const parts = change.file.split('/');
        if (parts.length > 1) {
          scopes.add(parts[0]);
        }
      });
      
      // Determine commit type based on changes
      let commitType = 'chore';
      let description = '';
      
      if (repo.name.includes('ui-components') || fileTypes.has('tsx') || fileTypes.has('jsx')) {
        if (additions > modifications) {
          commitType = 'feat';
          description = 'add new components and features';
        } else {
          commitType = 'refactor';
          description = 'update UI components and improve structure';
        }
      } else if (fileTypes.has('test') || fileTypes.has('spec')) {
        commitType = 'test';
        description = 'update test suite';
      } else if (fileTypes.has('md')) {
        commitType = 'docs';
        description = 'update documentation';
      } else if (modifications > additions) {
        commitType = 'fix';
        description = 'fix issues and improve stability';
      } else if (additions > 0) {
        commitType = 'feat';
        description = 'add new functionality';
      }
      
      // Build detailed description
      const changes = [];
      if (additions > 0) changes.push(`${additions} addition${additions > 1 ? 's' : ''}`);
      if (modifications > 0) changes.push(`${modifications} modification${modifications > 1 ? 's' : ''}`);
      if (deletions > 0) changes.push(`${deletions} deletion${deletions > 1 ? 's' : ''}`);
      
      const scope = scopes.size === 1 ? Array.from(scopes)[0] : repo.name;
      const message = `${commitType}(${scope}): ${description}\n\n` +
        `• ${totalFiles} files changed with ${changes.join(', ')}\n` +
        `• Primary file types: ${Array.from(fileTypes).slice(0, 3).join(', ')}`;
      
      processedCount++;
      onProgress?.({
        stage: 'generating',
        message: `Generated: ${repo.name}`,
        current: processedCount,
        total: reposWithChanges.length
      });
      
      this.log(`✓ ${repo.name}: Pattern-based message`, 'info');
      
      return {
        ...repo,
        generatedCommitMessage: message
      };
    });
  }

  /**
   * Fallback executive summary generation - enhanced with analysis
   */
  private generateFallbackExecutiveSummary(
    repositories: RepositoryChangeData[]
  ): string {
    const changedRepos = repositories.filter(r => r.hasChanges);
    
    if (changedRepos.length === 0) {
      return 'No changes detected across any repositories.';
    }

    // Gather statistics
    const stats = {
      totalFiles: 0,
      totalAdditions: 0,
      totalModifications: 0,
      totalDeletions: 0,
      byType: new Map<string, number>()
    };

    // Analyze commit messages and changes
    const themes = new Map<string, string[]>();
    
    changedRepos.forEach(repo => {
      const repoStats = repo.statistics || {};
      stats.totalFiles += repoStats.totalFiles || 0;
      stats.totalAdditions += repoStats.additions || 0;
      stats.totalModifications += repoStats.modifications || 0;
      stats.totalDeletions += repoStats.deletions || 0;
      
      // Extract commit type from message
      if (repo.generatedCommitMessage) {
        const match = repo.generatedCommitMessage.match(/^(\w+)(\([\w-]+\))?:/);
        if (match) {
          const type = match[1];
          stats.byType.set(type, (stats.byType.get(type) || 0) + 1);
          
          // Group by theme
          if (type === 'feat') {
            if (!themes.has('New Features')) themes.set('New Features', []);
            themes.get('New Features')!.push(repo.name);
          } else if (type === 'fix') {
            if (!themes.has('Bug Fixes')) themes.set('Bug Fixes', []);
            themes.get('Bug Fixes')!.push(repo.name);
          } else if (type === 'refactor') {
            if (!themes.has('Code Improvements')) themes.set('Code Improvements', []);
            themes.get('Code Improvements')!.push(repo.name);
          } else if (type === 'docs') {
            if (!themes.has('Documentation')) themes.set('Documentation', []);
            themes.get('Documentation')!.push(repo.name);
          }
        }
      }
    });

    // Build comprehensive summary
    const lines = [
      `## Executive Summary\n`,
      `This change set encompasses ${changedRepos.length} repositories with a total of ${stats.totalFiles} files modified.\n`,
      `### Impact Overview`,
      `- **Total Changes**: ${stats.totalFiles} files (${stats.totalAdditions} additions, ${stats.totalModifications} modifications, ${stats.totalDeletions} deletions)`,
      `- **Affected Packages**: ${changedRepos.map(r => r.name).join(', ')}`,
      `- **Change Distribution**: ${Array.from(stats.byType.entries()).map(([type, count]) => `${type} (${count})`).join(', ')}\n`
    ];

    // Add themes section
    if (themes.size > 0) {
      lines.push(`### Key Themes`);
      themes.forEach((repos, theme) => {
        lines.push(`\n**${theme}**`);
        lines.push(`Affecting: ${repos.join(', ')}`);
      });
      lines.push('');
    }

    // Add risk assessment
    const riskLevel = stats.totalFiles > 50 ? 'HIGH' : 
                     stats.totalFiles > 20 ? 'MEDIUM' : 'LOW';
    
    lines.push(`### Risk Assessment`);
    lines.push(`- **Overall Risk Level**: ${riskLevel}`);
    lines.push(`- **Rationale**: ${
      riskLevel === 'HIGH' ? 'Large number of changes across multiple packages may require extensive testing' :
      riskLevel === 'MEDIUM' ? 'Moderate changes that should be reviewed carefully before deployment' :
      'Limited changes with minimal risk to system stability'
    }\n`);

    // Add recommendations
    lines.push(`### Recommendations`);
    lines.push(`1. Review all changes carefully, especially in critical packages`);
    if (stats.totalFiles > 10) {
      lines.push(`2. Consider breaking changes into smaller, focused commits`);
    }
    if (themes.has('New Features')) {
      lines.push(`3. Ensure new features have adequate test coverage`);
    }
    if (themes.has('Bug Fixes')) {
      lines.push(`4. Verify bug fixes with regression testing`);
    }
    lines.push(`5. Update documentation for any API or interface changes`);

    return lines.join('\n');
  }
}

// Export singleton instance
// Create singleton instance
const service = new GraphQLChangeReviewService();

// Export with the expected interface
export const graphqlChangeReviewService = {
  async performComprehensiveReview(
    onProgress?: (progress: ScanProgress) => void, 
    onLogEntry?: (entry: LogEntry) => void
  ): Promise<ChangeReviewReport> {
    return service.performComprehensiveReview(onProgress, onLogEntry);
  },
  
  resetReviewState() {
    service.resetReviewState();
  },
  
  async generateChangeReviewReport(
    onProgress?: (progress: ScanProgress) => void,
    onLogEntry?: (entry: LogEntry) => void
  ): Promise<ChangeReviewReport> {
    return service.performComprehensiveReview(onProgress, onLogEntry);
  },
  
  async commitRepository(
    repositoryPath: string,
    commitMessage: string,
    _files?: string[]
  ): Promise<{ success: boolean; commitHash?: string; error?: string }> {
    try {
      console.log('[graphqlChangeReviewService] commitRepository called:', {
        repositoryPath,
        commitMessage: commitMessage.substring(0, 50) + '...'
      });
      
      const commits = await service.batchCommit([{ repoPath: repositoryPath, message: commitMessage }]);
      console.log('[graphqlChangeReviewService] batchCommit response:', commits);
      
      const result = commits.results?.[0];
      const response = {
        success: result?.success || false,
        commitHash: result?.commitHash,
        error: result?.error
      };
      
      console.log('[graphqlChangeReviewService] commitRepository result:', response);
      return response;
    } catch (error) {
      console.error('[graphqlChangeReviewService] commitRepository error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to commit'
      };
    }
  },
  
  async pushRepository(
    repositoryPath: string
  ): Promise<{ success: boolean; branch?: string; error?: string }> {
    try {
      console.log('[graphqlChangeReviewService] pushRepository called for:', repositoryPath);
      
      const { data } = await client.mutate({
        mutation: PUSH_CHANGES,
        variables: { 
          input: {
            repository: repositoryPath,
            setUpstream: true
          }
        }
      });
      
      console.log('[graphqlChangeReviewService] Push response:', data);
      
      if (data?.pushChanges) {
        const result = {
          success: data.pushChanges.success,
          branch: data.pushChanges.branch,
          error: data.pushChanges.error
        };
        console.log('[graphqlChangeReviewService] Push result:', result);
        return result;
      }
      
      return {
        success: false,
        error: 'No data returned from push mutation'
      };
    } catch (error) {
      console.error('[graphqlChangeReviewService] Push error:', error);
      // Extract more specific error messages
      let errorMessage = 'Failed to push';
      if (error instanceof Error) {
        errorMessage = error.message;
        // Check for GraphQL errors
        if ((error as any).graphQLErrors?.length > 0) {
          errorMessage = (error as any).graphQLErrors[0].message;
        }
      }
      return {
        success: false,
        error: errorMessage
      };
    }
  },
  
  async batchCommit(commits: Array<{ repoPath: string; message: string }>): Promise<any> {
    return service.batchCommit(commits);
  },
  
  async batchPush(repoPaths: string[]): Promise<any> {
    // TODO: Implement batch push functionality when available in GraphQL
    return {
      results: repoPaths.map(path => ({
        repository: path.split('/').pop() || path,
        success: false,
        error: 'Push functionality not yet implemented in GraphQL'
      }))
    };
  },
  
  async hierarchicalCommitAndPush(message: string): Promise<any> {
    return service.hierarchicalCommitAndPush(message);
  }
};