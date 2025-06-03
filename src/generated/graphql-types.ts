export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  Repo__Any: { input: any; output: any; }
  Repo_federation__ContextFieldValue: { input: any; output: any; }
  Repo_federation__FieldSet: { input: string; output: string; }
  Repo_federation__Policy: { input: string; output: string; }
  Repo_federation__Scope: { input: string; output: string; }
  Repo_link__Import: { input: string; output: string; }
};

export type Claude_AgentInput = {
  __typename?: 'Claude_AgentInput';
  diff: Scalars['String']['output'];
  model: Scalars['String']['output'];
  prompt: Scalars['String']['output'];
  recentCommits: Array<Scalars['String']['output']>;
  temperature: Scalars['Float']['output'];
};

export type Claude_AgentOutput = {
  __typename?: 'Claude_AgentOutput';
  confidence: Scalars['Float']['output'];
  message: Scalars['String']['output'];
  rawResponse: Scalars['String']['output'];
  reasoning: Maybe<Scalars['String']['output']>;
  tokensUsed: Scalars['Int']['output'];
};

export type Claude_AgentRun = {
  __typename?: 'Claude_AgentRun';
  completedAt: Maybe<Scalars['String']['output']>;
  duration: Maybe<Scalars['Int']['output']>;
  error: Maybe<Claude_RunError>;
  id: Scalars['ID']['output'];
  input: Claude_AgentInput;
  output: Maybe<Claude_AgentOutput>;
  parentRunId: Maybe<Scalars['ID']['output']>;
  repository: Scalars['String']['output'];
  retryCount: Scalars['Int']['output'];
  startedAt: Scalars['String']['output'];
  status: Claude_RunStatus;
};

export type Claude_AgentRunConnection = {
  __typename?: 'Claude_AgentRunConnection';
  runs: Array<Claude_AgentRun>;
  total: Scalars['Int']['output'];
};

export type Claude_AgentRunProgress = {
  __typename?: 'Claude_AgentRunProgress';
  /** Current operation description */
  currentOperation: Maybe<Scalars['String']['output']>;
  /** Error if any occurred */
  error: Maybe<Scalars['String']['output']>;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining: Maybe<Scalars['Int']['output']>;
  /** Whether this run is complete */
  isComplete: Scalars['Boolean']['output'];
  /** Progress percentage (0-100) */
  percentage: Scalars['Float']['output'];
  /** Repository being processed */
  repository: Scalars['String']['output'];
  /** Run ID this progress update is for */
  runId: Scalars['ID']['output'];
  /** Current stage of processing */
  stage: Claude_ProgressStage;
  /** Timestamp of this update */
  timestamp: Scalars['String']['output'];
};

export type Claude_BatchCommitMessageInput = {
  /** Whether to analyze relationships between changes */
  analyzeRelationships: InputMaybe<Scalars['Boolean']['input']>;
  /** Additional context for all commits */
  globalContext: InputMaybe<Scalars['String']['input']>;
  /** Repository information for commit message generation */
  repositories: Array<Claude_RepositoryCommitInfo>;
  /** Style guide for commit messages */
  styleGuide: InputMaybe<Claude_CommitStyleGuide>;
};

export type Claude_BatchCommitMessageResult = {
  __typename?: 'Claude_BatchCommitMessageResult';
  /** Execution time in milliseconds */
  executionTime: Scalars['Int']['output'];
  /** Individual results per repository */
  results: Array<Claude_CommitMessageResult>;
  /** Number of successful generations */
  successCount: Scalars['Int']['output'];
  /** Total repositories processed */
  totalRepositories: Scalars['Int']['output'];
  /** Total token usage */
  totalTokenUsage: Claude_TokenUsage;
};

export type Claude_BatchProgress = {
  __typename?: 'Claude_BatchProgress';
  /** Batch ID for this group of operations */
  batchId: Scalars['ID']['output'];
  /** Number of completed operations */
  completedOperations: Scalars['Int']['output'];
  /** Estimated total time remaining */
  estimatedTimeRemaining: Maybe<Scalars['Int']['output']>;
  /** Number of failed operations */
  failedOperations: Scalars['Int']['output'];
  /** Whether batch is complete */
  isComplete: Scalars['Boolean']['output'];
  /** Overall progress percentage */
  overallPercentage: Scalars['Float']['output'];
  /** Individual run progress */
  runProgress: Array<Claude_AgentRunProgress>;
  /** Batch start time */
  startTime: Scalars['String']['output'];
  /** Total number of operations in batch */
  totalOperations: Scalars['Int']['output'];
};

export type Claude_ChangeStats = {
  /** Lines added */
  additions: Scalars['Int']['input'];
  /** Lines deleted */
  deletions: Scalars['Int']['input'];
  /** Files changed */
  filesChanged: Scalars['Int']['input'];
};

export type Claude_ClaudeExecuteInput = {
  /** Additional context to provide */
  context: InputMaybe<Claude_ContextInput>;
  /** Command options */
  options: InputMaybe<Claude_CommandOptions>;
  /** The prompt or command to execute */
  prompt: Scalars['String']['input'];
  /** Optional session ID to reuse */
  sessionId: InputMaybe<Scalars['ID']['input']>;
  /** Working directory for the command */
  workingDirectory: InputMaybe<Scalars['String']['input']>;
};

export type Claude_ClaudeExecuteResult = {
  __typename?: 'Claude_ClaudeExecuteResult';
  /** Error message if failed to start */
  error: Maybe<Scalars['String']['output']>;
  /** Initial response if available immediately */
  initialResponse: Maybe<Scalars['String']['output']>;
  /** Execution metadata */
  metadata: Claude_ExecutionMetadata;
  /** Session ID for this execution */
  sessionId: Scalars['ID']['output'];
  /** Whether execution started successfully */
  success: Scalars['Boolean']['output'];
};

export type Claude_ClaudeSession = {
  __typename?: 'Claude_ClaudeSession';
  /** Session creation timestamp */
  createdAt: Scalars['String']['output'];
  /** Command history */
  history: Array<Claude_CommandHistoryItem>;
  /** Unique session identifier */
  id: Scalars['ID']['output'];
  /** Last activity timestamp */
  lastActivity: Scalars['String']['output'];
  /** Session metadata */
  metadata: Claude_SessionMetadata;
  /** Process ID if active */
  pid: Maybe<Scalars['Int']['output']>;
  /** Current session status */
  status: Claude_SessionStatus;
  /** Current working directory */
  workingDirectory: Scalars['String']['output'];
};

export type Claude_CommandHistoryItem = {
  __typename?: 'Claude_CommandHistoryItem';
  /** Execution time in milliseconds */
  executionTime: Scalars['Int']['output'];
  /** The prompt or command sent */
  prompt: Scalars['String']['output'];
  /** Response received */
  response: Maybe<Scalars['String']['output']>;
  /** Whether command succeeded */
  success: Scalars['Boolean']['output'];
  /** Command timestamp */
  timestamp: Scalars['String']['output'];
};

export type Claude_CommandOptions = {
  /** Custom flags to pass to Claude CLI */
  customFlags: InputMaybe<Array<Scalars['String']['input']>>;
  /** Maximum response tokens */
  maxTokens: InputMaybe<Scalars['Int']['input']>;
  /** Model to use (if different from default) */
  model: InputMaybe<Scalars['String']['input']>;
  /** Whether to stream output */
  stream: InputMaybe<Scalars['Boolean']['input']>;
  /** Temperature setting */
  temperature: InputMaybe<Scalars['Float']['input']>;
};

export type Claude_CommandOutput = {
  __typename?: 'Claude_CommandOutput';
  /** The actual output content */
  content: Scalars['String']['output'];
  /** Whether this is the final output */
  isFinal: Scalars['Boolean']['output'];
  /** Session ID this output belongs to */
  sessionId: Scalars['ID']['output'];
  /** Timestamp of this output */
  timestamp: Scalars['String']['output'];
  /** Token count for this output chunk */
  tokens: Maybe<Scalars['Int']['output']>;
  /** Output type */
  type: Claude_OutputType;
};

export type Claude_CommitMessageInfo = {
  /** Commit message */
  message: Scalars['String']['input'];
  /** Repository name */
  repository: Scalars['String']['input'];
  /** Change statistics */
  stats: InputMaybe<Claude_ChangeStats>;
};

export type Claude_CommitMessageResult = {
  __typename?: 'Claude_CommitMessageResult';
  /** Suggested commit type (feat, fix, chore, etc.) */
  commitType: Maybe<Scalars['String']['output']>;
  /** Confidence score (0-1) */
  confidence: Maybe<Scalars['Float']['output']>;
  /** Error if generation failed */
  error: Maybe<Scalars['String']['output']>;
  /** Generated commit message */
  message: Maybe<Scalars['String']['output']>;
  /** Repository name */
  repositoryName: Scalars['String']['output'];
  /** Repository path */
  repositoryPath: Scalars['String']['output'];
  /** Whether generation succeeded */
  success: Scalars['Boolean']['output'];
};

export type Claude_CommitStyleGuide = {
  /** Custom examples */
  examples: InputMaybe<Array<Scalars['String']['input']>>;
  /** Preferred format (conventional, descriptive, etc.) */
  format: InputMaybe<Scalars['String']['input']>;
  /** Whether to include body */
  includeBody: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether to include scope */
  includeScope: InputMaybe<Scalars['Boolean']['input']>;
  /** Maximum message length */
  maxLength: InputMaybe<Scalars['Int']['input']>;
};

export type Claude_ContextInput = {
  /** Files to include in context */
  files: InputMaybe<Array<Scalars['String']['input']>>;
  /** Additional instructions */
  instructions: InputMaybe<Scalars['String']['input']>;
  /** Maximum context size in tokens */
  maxTokens: InputMaybe<Scalars['Int']['input']>;
  /** Project-specific context */
  projectContext: InputMaybe<Scalars['String']['input']>;
};

export type Claude_ContinueSessionInput = {
  /** Optional additional context */
  additionalContext: InputMaybe<Claude_ContextInput>;
  /** New prompt to send */
  prompt: Scalars['String']['input'];
  /** Session ID to continue */
  sessionId: Scalars['ID']['input'];
};

export type Claude_ExecutionMetadata = {
  __typename?: 'Claude_ExecutionMetadata';
  /** Estimated completion time */
  estimatedTime: Maybe<Scalars['Int']['output']>;
  /** Command flags used */
  flags: Array<Scalars['String']['output']>;
  /** Process ID */
  pid: Maybe<Scalars['Int']['output']>;
  /** When execution started */
  startTime: Scalars['String']['output'];
};

export type Claude_ExecutiveSummaryInput = {
  /** Target audience for summary */
  audience: InputMaybe<Scalars['String']['input']>;
  /** Commit messages to summarize */
  commitMessages: Array<Claude_CommitMessageInfo>;
  /** Focus areas for summary */
  focusAreas: InputMaybe<Array<Scalars['String']['input']>>;
  /** Whether to include recommendations */
  includeRecommendations: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether to include risk assessment */
  includeRiskAssessment: InputMaybe<Scalars['Boolean']['input']>;
  /** Desired summary length */
  maxLength: InputMaybe<Scalars['Int']['input']>;
};

export type Claude_ExecutiveSummaryResult = {
  __typename?: 'Claude_ExecutiveSummaryResult';
  /** Error if generation failed */
  error: Maybe<Scalars['String']['output']>;
  /** Summary metadata */
  metadata: Claude_SummaryMetadata;
  /** Whether summary generation succeeded */
  success: Scalars['Boolean']['output'];
  /** The generated executive summary */
  summary: Maybe<Scalars['String']['output']>;
};

export type Claude_HandoffInput = {
  /** Whether to include full history */
  includeFullHistory: InputMaybe<Scalars['Boolean']['input']>;
  /** Additional notes for handoff */
  notes: InputMaybe<Scalars['String']['input']>;
  /** Session ID to create handoff for */
  sessionId: Scalars['ID']['input'];
  /** Target for handoff (user, team, etc.) */
  target: InputMaybe<Scalars['String']['input']>;
};

export type Claude_HandoffResult = {
  __typename?: 'Claude_HandoffResult';
  /** Handoff document content */
  content: Maybe<Scalars['String']['output']>;
  /** Path to handoff document */
  documentPath: Maybe<Scalars['String']['output']>;
  /** Error message if failed */
  error: Maybe<Scalars['String']['output']>;
  /** Session state summary */
  sessionSummary: Claude_SessionSummary;
  /** Whether handoff document was created successfully */
  success: Scalars['Boolean']['output'];
};

export type Claude_HealthStatus = {
  __typename?: 'Claude_HealthStatus';
  /** Number of active sessions */
  activeSessions: Scalars['Int']['output'];
  /** Claude CLI availability */
  claudeAvailable: Scalars['Boolean']['output'];
  /** Claude CLI version if available */
  claudeVersion: Maybe<Scalars['String']['output']>;
  /** Whether service is healthy */
  healthy: Scalars['Boolean']['output'];
  /** System resource usage */
  resources: Claude_ResourceUsage;
  /** Service version */
  version: Scalars['String']['output'];
};

export enum Claude_ImpactLevel {
  /** Critical impact on core functionality */
  Critical = 'CRITICAL',
  /** Major impact, may break compatibility */
  Major = 'MAJOR',
  /** Minor impact on functionality */
  Minor = 'MINOR',
  /** Moderate impact, backwards compatible */
  Moderate = 'MODERATE'
}

export type Claude_OperationMetrics = {
  __typename?: 'Claude_OperationMetrics';
  /** Average duration in milliseconds */
  averageDuration: Scalars['Float']['output'];
  /** Number of executions */
  count: Scalars['Int']['output'];
  /** Maximum duration in milliseconds */
  maxDuration: Scalars['Float']['output'];
  /** Minimum duration in milliseconds */
  minDuration: Scalars['Float']['output'];
  /** Operation name */
  operation: Scalars['String']['output'];
  /** 95th percentile duration */
  p95Duration: Scalars['Float']['output'];
  /** 99th percentile duration */
  p99Duration: Scalars['Float']['output'];
  /** Success rate percentage */
  successRate: Scalars['Float']['output'];
  /** Total duration in milliseconds */
  totalDuration: Scalars['Float']['output'];
};

export enum Claude_OutputType {
  /** Final response */
  Final = 'FINAL',
  /** Progress update */
  Progress = 'PROGRESS',
  /** Error output */
  Stderr = 'STDERR',
  /** Standard output */
  Stdout = 'STDOUT',
  /** System message */
  System = 'SYSTEM'
}

export type Claude_ParallelComparison = {
  __typename?: 'Claude_ParallelComparison';
  /** Efficiency percentage */
  efficiency: Scalars['Float']['output'];
  /** Metrics for parallel execution */
  parallel: Maybe<Claude_OperationMetrics>;
  /** Metrics for sequential execution */
  sequential: Maybe<Claude_OperationMetrics>;
  /** Speed improvement factor (sequential/parallel) */
  speedup: Scalars['Float']['output'];
};

export type Claude_PerformanceReport = {
  __typename?: 'Claude_PerformanceReport';
  /** Aggregated metrics by operation */
  operations: Array<Claude_OperationMetrics>;
  /** Comparison of parallel vs sequential execution */
  parallelComparison: Maybe<Claude_ParallelComparison>;
  /** Time range of the report */
  timeRange: Claude_TimeRange;
  /** Total operations tracked */
  totalOperations: Scalars['Int']['output'];
};

export enum Claude_ProgressStage {
  /** Cancelled by user */
  Cancelled = 'CANCELLED',
  /** Completed successfully */
  Completed = 'COMPLETED',
  /** Failed with error */
  Failed = 'FAILED',
  /** Initializing Claude session */
  Initializing = 'INITIALIZING',
  /** Loading context and files */
  LoadingContext = 'LOADING_CONTEXT',
  /** Parsing response */
  ParsingResponse = 'PARSING_RESPONSE',
  /** Processing with Claude */
  Processing = 'PROCESSING',
  /** Queued for processing */
  Queued = 'QUEUED',
  /** Saving results */
  SavingResults = 'SAVING_RESULTS'
}

export type Claude_RepositoryCommitInfo = {
  /** Additional repository context */
  context: InputMaybe<Scalars['String']['input']>;
  /** Git diff of changes */
  diff: Scalars['String']['input'];
  /** Files changed */
  filesChanged: Array<Scalars['String']['input']>;
  /** Repository name */
  name: Scalars['String']['input'];
  /** Repository path */
  path: Scalars['String']['input'];
  /** Recent commit history for style matching */
  recentCommits: InputMaybe<Array<Scalars['String']['input']>>;
};

export type Claude_RepositoryCount = {
  __typename?: 'Claude_RepositoryCount';
  count: Scalars['Int']['output'];
  repository: Scalars['String']['output'];
};

export type Claude_ResourceUsage = {
  __typename?: 'Claude_ResourceUsage';
  /** Number of active processes */
  activeProcesses: Scalars['Int']['output'];
  /** CPU usage percentage */
  cpuUsage: Scalars['Float']['output'];
  /** Memory usage in MB */
  memoryUsage: Scalars['Float']['output'];
};

export enum Claude_RiskLevel {
  /** Critical risks requiring immediate action */
  Critical = 'CRITICAL',
  /** Significant risks requiring attention */
  High = 'HIGH',
  /** No significant risks identified */
  Low = 'LOW',
  /** Minor risks that should be monitored */
  Medium = 'MEDIUM'
}

export type Claude_RunError = {
  __typename?: 'Claude_RunError';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  recoverable: Scalars['Boolean']['output'];
  stackTrace: Maybe<Scalars['String']['output']>;
};

export type Claude_RunStatistics = {
  __typename?: 'Claude_RunStatistics';
  averageDuration: Scalars['Float']['output'];
  byRepository: Array<Claude_RepositoryCount>;
  byStatus: Claude_StatusCount;
  successRate: Scalars['Float']['output'];
  total: Scalars['Int']['output'];
};

export enum Claude_RunStatus {
  Cancelled = 'CANCELLED',
  Failed = 'FAILED',
  Queued = 'QUEUED',
  Retrying = 'RETRYING',
  Running = 'RUNNING',
  Success = 'SUCCESS'
}

export type Claude_SessionMetadata = {
  __typename?: 'Claude_SessionMetadata';
  /** Custom flags or options */
  flags: Array<Scalars['String']['output']>;
  /** Model being used */
  model: Scalars['String']['output'];
  /** Project context if loaded */
  projectContext: Maybe<Scalars['String']['output']>;
  /** Token usage statistics */
  tokenUsage: Claude_TokenUsage;
};

export enum Claude_SessionStatus {
  /** Session is active and ready */
  Active = 'ACTIVE',
  /** Session encountered an error */
  Error = 'ERROR',
  /** Session is idle */
  Idle = 'IDLE',
  /** Session is processing a command */
  Processing = 'PROCESSING',
  /** Session has been terminated */
  Terminated = 'TERMINATED'
}

export type Claude_SessionSummary = {
  __typename?: 'Claude_SessionSummary';
  /** Files modified during session */
  filesModified: Array<Scalars['String']['output']>;
  /** Number of interactions in session */
  interactionCount: Scalars['Int']['output'];
  /** Key topics discussed */
  topics: Array<Scalars['String']['output']>;
  /** Total tokens used */
  totalTokens: Scalars['Int']['output'];
};

export type Claude_StatusCount = {
  __typename?: 'Claude_StatusCount';
  CANCELLED: Scalars['Int']['output'];
  FAILED: Scalars['Int']['output'];
  QUEUED: Scalars['Int']['output'];
  RETRYING: Scalars['Int']['output'];
  RUNNING: Scalars['Int']['output'];
  SUCCESS: Scalars['Int']['output'];
};

export type Claude_SummaryMetadata = {
  __typename?: 'Claude_SummaryMetadata';
  /** Number of repositories analyzed */
  repositoryCount: Scalars['Int']['output'];
  /** Risk assessment */
  riskLevel: Claude_RiskLevel;
  /** Suggested actions */
  suggestedActions: Array<Scalars['String']['output']>;
  /** Key themes identified */
  themes: Array<Claude_Theme>;
  /** Total changes summarized */
  totalChanges: Scalars['Int']['output'];
};

export type Claude_Theme = {
  __typename?: 'Claude_Theme';
  /** Affected repositories */
  affectedRepositories: Array<Scalars['String']['output']>;
  /** Theme description */
  description: Scalars['String']['output'];
  /** Impact level */
  impact: Claude_ImpactLevel;
  /** Theme name */
  name: Scalars['String']['output'];
};

export type Claude_TimeRange = {
  __typename?: 'Claude_TimeRange';
  /** Duration in minutes */
  durationMinutes: Scalars['Int']['output'];
  /** End time of the range */
  end: Scalars['String']['output'];
  /** Start time of the range */
  start: Scalars['String']['output'];
};

export type Claude_TokenUsage = {
  __typename?: 'Claude_TokenUsage';
  /** Estimated cost in USD */
  estimatedCost: Scalars['Float']['output'];
  /** Total input tokens used */
  inputTokens: Scalars['Int']['output'];
  /** Total output tokens used */
  outputTokens: Scalars['Int']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  /** Commit changes across multiple repositories */
  batchCommit: Repo_BatchCommitResult;
  /** Cancel a running agent */
  cancelAgentRun: Claude_AgentRun;
  /** Stage and commit changes */
  commitChanges: Repo_CommitResult;
  /** Continue an existing Claude session with a new prompt */
  continueSession: Claude_ClaudeExecuteResult;
  /** Create a handoff document for session transfer */
  createHandoff: Claude_HandoffResult;
  /** Delete old runs (admin only) */
  deleteOldRuns: Scalars['Int']['output'];
  /** Execute a Claude command in a new or existing session */
  executeCommand: Claude_ClaudeExecuteResult;
  /** Execute a git command (with safety restrictions) */
  executeGitCommand: Repo_GitCommandResult;
  /** Generate commit messages for multiple repositories */
  generateCommitMessages: Claude_BatchCommitMessageResult;
  /** Generate executive summary from multiple commit messages */
  generateExecutiveSummary: Claude_ExecutiveSummaryResult;
  /** Kill an active Claude session */
  killSession: Scalars['Boolean']['output'];
  /** Push changes to remote repository */
  pushChanges: Repo_PushResult;
  /** Retry a failed run */
  retryAgentRun: Claude_AgentRun;
  /** Retry all failed runs in a batch */
  retryFailedRuns: Array<Claude_AgentRun>;
};


export type MutationBatchCommitArgs = {
  input: Repo_BatchCommitInput;
};


export type MutationCancelAgentRunArgs = {
  runId: Scalars['ID']['input'];
};


export type MutationCommitChangesArgs = {
  input: Repo_CommitInput;
};


export type MutationContinueSessionArgs = {
  input: Claude_ContinueSessionInput;
};


export type MutationCreateHandoffArgs = {
  input: Claude_HandoffInput;
};


export type MutationExecuteCommandArgs = {
  input: Claude_ClaudeExecuteInput;
};


export type MutationExecuteGitCommandArgs = {
  input: Repo_GitCommandInput;
};


export type MutationGenerateCommitMessagesArgs = {
  input: Claude_BatchCommitMessageInput;
};


export type MutationGenerateExecutiveSummaryArgs = {
  input: Claude_ExecutiveSummaryInput;
};


export type MutationKillSessionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationPushChangesArgs = {
  input: Repo_PushInput;
};


export type MutationRetryAgentRunArgs = {
  runId: Scalars['ID']['input'];
};


export type MutationRetryFailedRunsArgs = {
  runIds: Array<Scalars['ID']['input']>;
};

export type Query = {
  __typename?: 'Query';
  _entities: Array<Maybe<Repo__Entity>>;
  _service: Repo__Service;
  /** Get specific run details */
  agentRun: Maybe<Claude_AgentRun>;
  /** List all runs with filtering */
  agentRuns: Claude_AgentRunConnection;
  /** Check service health and Claude availability */
  claudeHealth: Claude_HealthStatus;
  /** Get the current git status of a repository */
  gitStatus: Repo_GitStatus;
  /** Check if repository has uncommitted changes */
  isRepositoryClean: Repo_RepositoryCleanStatus;
  /** Get the latest commit hash for a repository */
  latestCommit: Repo_CommitInfo;
  /** Get performance metrics for operations */
  performanceMetrics: Claude_PerformanceReport;
  /** Get comprehensive information about a specific repository */
  repositoryDetails: Repo_RepositoryDetails;
  /** Get runs for a specific repository */
  repositoryRuns: Array<Claude_AgentRun>;
  /** Get repository with its Claude analysis status */
  repositoryWithAnalysis: Maybe<RepositoryWithAnalysis>;
  /** Get run statistics */
  runStatistics: Claude_RunStatistics;
  /** Perform a detailed scan with diffs and history */
  scanAllDetailed: Repo_DetailedScanReport;
  /** Scan workspace for all git repositories */
  scanAllRepositories: Array<Repo_RepositoryScan>;
  /** Get details of a specific session */
  session: Maybe<Claude_ClaudeSession>;
  /** List all active Claude sessions */
  sessions: Array<Claude_ClaudeSession>;
  /** List and get status of git submodules */
  submodules: Array<Repo_Submodule>;
  /** Combined health check for all services */
  systemHealth: SystemHealth;
};


export type Query_EntitiesArgs = {
  representations: Array<Scalars['Repo__Any']['input']>;
};


export type QueryAgentRunArgs = {
  id: Scalars['ID']['input'];
};


export type QueryAgentRunsArgs = {
  endDate: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  repository: InputMaybe<Scalars['String']['input']>;
  startDate: InputMaybe<Scalars['String']['input']>;
  status: InputMaybe<Claude_RunStatus>;
};


export type QueryGitStatusArgs = {
  path: Scalars['String']['input'];
};


export type QueryIsRepositoryCleanArgs = {
  path: Scalars['String']['input'];
};


export type QueryLatestCommitArgs = {
  path: Scalars['String']['input'];
};


export type QueryPerformanceMetricsArgs = {
  lastMinutes: InputMaybe<Scalars['Int']['input']>;
  operation: InputMaybe<Scalars['String']['input']>;
};


export type QueryRepositoryDetailsArgs = {
  path: Scalars['String']['input'];
};


export type QueryRepositoryRunsArgs = {
  repository: Scalars['String']['input'];
};


export type QueryRepositoryWithAnalysisArgs = {
  path: Scalars['String']['input'];
};


export type QuerySessionArgs = {
  id: Scalars['ID']['input'];
};

export type Repo_BatchCommitInput = {
  /** List of commits to perform */
  commits: Array<Repo_CommitInput>;
  /** Continue on error */
  continueOnError: InputMaybe<Scalars['Boolean']['input']>;
};

export type Repo_BatchCommitResult = {
  __typename?: 'Repo_BatchCommitResult';
  /** Total execution time in milliseconds */
  executionTime: Scalars['Int']['output'];
  /** Individual commit results */
  results: Array<Repo_CommitResult>;
  /** Number of successful commits */
  successCount: Scalars['Int']['output'];
  /** Total number of repositories processed */
  totalRepositories: Scalars['Int']['output'];
};

export type Repo_ChangesByType = {
  __typename?: 'Repo_ChangesByType';
  /** Number of added files */
  added: Scalars['Int']['output'];
  /** Number of deleted files */
  deleted: Scalars['Int']['output'];
  /** Number of modified files */
  modified: Scalars['Int']['output'];
  /** Number of renamed files */
  renamed: Scalars['Int']['output'];
  /** Number of untracked files */
  untracked: Scalars['Int']['output'];
};

export type Repo_Commit = {
  __typename?: 'Repo_Commit';
  /** Author name */
  author: Scalars['String']['output'];
  /** Author email */
  authorEmail: Scalars['String']['output'];
  /** Commit hash */
  hash: Scalars['String']['output'];
  /** Commit message */
  message: Scalars['String']['output'];
  /** Commit timestamp */
  timestamp: Scalars['String']['output'];
};

export type Repo_CommitInfo = {
  __typename?: 'Repo_CommitInfo';
  /** Author name */
  author: Scalars['String']['output'];
  /** Full commit hash */
  hash: Scalars['String']['output'];
  /** Commit message */
  message: Scalars['String']['output'];
  /** Repository path */
  repository: Scalars['String']['output'];
  /** Short commit hash */
  shortHash: Scalars['String']['output'];
  /** Commit timestamp */
  timestamp: Scalars['String']['output'];
};

export type Repo_CommitInput = {
  /** Author name (optional) */
  author: InputMaybe<Scalars['String']['input']>;
  /** Author email (optional) */
  authorEmail: InputMaybe<Scalars['String']['input']>;
  /** Specific files to commit (empty = all) */
  files: InputMaybe<Array<Scalars['String']['input']>>;
  /** Commit message */
  message: Scalars['String']['input'];
  /** Repository path */
  repository: Scalars['String']['input'];
  /** Stage all changes before committing */
  stageAll: InputMaybe<Scalars['Boolean']['input']>;
};

export type Repo_CommitResult = {
  __typename?: 'Repo_CommitResult';
  /** Commit hash if successful */
  commitHash: Maybe<Scalars['String']['output']>;
  /** Files that were committed */
  committedFiles: Array<Scalars['String']['output']>;
  /** Error message if failed */
  error: Maybe<Scalars['String']['output']>;
  /** Whether the repository is clean after commit */
  isClean: Maybe<Scalars['Boolean']['output']>;
  /** Number of remaining uncommitted files */
  remainingFiles: Maybe<Scalars['Int']['output']>;
  /** Repository path */
  repository: Scalars['String']['output'];
  /** Whether the commit succeeded */
  success: Scalars['Boolean']['output'];
};

export type Repo_DetailedRepository = {
  __typename?: 'Repo_DetailedRepository';
  /** Repository configuration */
  config: Repo_RepositoryConfig;
  /** Repository name */
  name: Scalars['String']['output'];
  /** Absolute path */
  path: Scalars['String']['output'];
  /** Recent commits */
  recentCommits: Array<Repo_Commit>;
  /** Remote repositories */
  remotes: Array<Repo_Remote>;
  /** Diff of staged changes */
  stagedDiff: Maybe<Scalars['String']['output']>;
  /** Current git status */
  status: Repo_GitStatus;
  /** Diff of unstaged changes */
  unstagedDiff: Maybe<Scalars['String']['output']>;
};

export type Repo_DetailedScanReport = {
  __typename?: 'Repo_DetailedScanReport';
  /** Scan metadata */
  metadata: Repo_ScanMetadata;
  /** List of all repositories with detailed information */
  repositories: Array<Repo_DetailedRepository>;
  /** Aggregate statistics */
  statistics: Repo_ScanStatistics;
};

export type Repo_FileStatus = {
  __typename?: 'Repo_FileStatus';
  /** Whether the file is staged */
  isStaged: Scalars['Boolean']['output'];
  /** File path relative to repository root */
  path: Scalars['String']['output'];
  /** Git status code (M, A, D, ??, etc.) */
  status: Scalars['String']['output'];
  /** Human-readable status description */
  statusDescription: Scalars['String']['output'];
};

export type Repo_GitCommandInput = {
  /** Command arguments */
  args: Array<Scalars['String']['input']>;
  /** Git command to execute */
  command: Scalars['String']['input'];
  /** Working directory */
  cwd: Scalars['String']['input'];
};

export type Repo_GitCommandResult = {
  __typename?: 'Repo_GitCommandResult';
  /** Error message if failed */
  error: Maybe<Scalars['String']['output']>;
  /** Command output */
  output: Maybe<Scalars['String']['output']>;
  /** Whether the command succeeded */
  success: Scalars['Boolean']['output'];
};

export type Repo_GitStatus = {
  __typename?: 'Repo_GitStatus';
  /** Number of commits ahead of remote */
  ahead: Scalars['Int']['output'];
  /** Number of commits behind remote */
  behind: Scalars['Int']['output'];
  /** Current branch name */
  branch: Scalars['String']['output'];
  /** List of files with changes */
  files: Array<Repo_FileStatus>;
  /** Whether the branch has a remote tracking branch */
  hasRemote: Scalars['Boolean']['output'];
  /** Whether there are uncommitted changes */
  isDirty: Scalars['Boolean']['output'];
  /** List of stashes */
  stashes: Array<Repo_Stash>;
};

export type Repo_PushInput = {
  /** Branch to push (default: current) */
  branch: InputMaybe<Scalars['String']['input']>;
  /** Force push */
  force: InputMaybe<Scalars['Boolean']['input']>;
  /** Remote name (default: origin) */
  remote: InputMaybe<Scalars['String']['input']>;
  /** Repository path */
  repository: Scalars['String']['input'];
};

export type Repo_PushResult = {
  __typename?: 'Repo_PushResult';
  /** Branch that was pushed */
  branch: Scalars['String']['output'];
  /** Error message if failed */
  error: Maybe<Scalars['String']['output']>;
  /** Remote that was pushed to */
  remote: Scalars['String']['output'];
  /** Whether the push succeeded */
  success: Scalars['Boolean']['output'];
  /** Push summary from git */
  summary: Maybe<Scalars['String']['output']>;
};

export type Repo_Remote = {
  __typename?: 'Repo_Remote';
  /** Fetch URL */
  fetchUrl: Scalars['String']['output'];
  /** Remote name (e.g., origin) */
  name: Scalars['String']['output'];
  /** Push URL */
  pushUrl: Scalars['String']['output'];
};

export type Repo_Repository = {
  __typename?: 'Repo_Repository';
  /** Current branch */
  branch: Scalars['String']['output'];
  /** Whether repository has uncommitted changes */
  isDirty: Scalars['Boolean']['output'];
  /** Repository name */
  name: Scalars['String']['output'];
  /** Absolute path to the repository */
  path: Scalars['String']['output'];
  /** Current git status */
  status: Repo_GitStatus;
};

export type Repo_RepositoryActivity = {
  __typename?: 'Repo_RepositoryActivity';
  /** Last commit date */
  lastCommitDate: Scalars['String']['output'];
  /** Most active contributor */
  mostActiveContributor: Scalars['String']['output'];
  /** Recent branches */
  recentBranches: Array<Scalars['String']['output']>;
};

export type Repo_RepositoryCleanStatus = {
  __typename?: 'Repo_RepositoryCleanStatus';
  /** Whether the repository is clean (no uncommitted changes) */
  isClean: Scalars['Boolean']['output'];
  /** Latest commit hash */
  latestCommitHash: Scalars['String']['output'];
  /** Repository path */
  repository: Scalars['String']['output'];
  /** Number of uncommitted files */
  uncommittedFiles: Scalars['Int']['output'];
};

export type Repo_RepositoryConfig = {
  __typename?: 'Repo_RepositoryConfig';
  /** Default branch name */
  defaultBranch: Scalars['String']['output'];
  /** Whether this is a bare repository */
  isBare: Scalars['Boolean']['output'];
  /** Whether this is a shallow clone */
  isShallow: Scalars['Boolean']['output'];
};

export type Repo_RepositoryDetails = {
  __typename?: 'Repo_RepositoryDetails';
  /** Recent activity */
  activity: Repo_RepositoryActivity;
  /** Repository name */
  name: Scalars['String']['output'];
  /** Absolute path */
  path: Scalars['String']['output'];
  /** Repository statistics */
  statistics: Repo_RepositoryStatistics;
  /** Current git status */
  status: Repo_GitStatus;
};

export type Repo_RepositoryScan = {
  __typename?: 'Repo_RepositoryScan';
  /** Current branch */
  branch: Scalars['String']['output'];
  /** Whether repository has uncommitted changes */
  isDirty: Scalars['Boolean']['output'];
  /** Repository name */
  name: Scalars['String']['output'];
  /** Absolute path to repository */
  path: Scalars['String']['output'];
  /** Repository type */
  type: Repo_RepositoryType;
  /** Number of uncommitted files */
  uncommittedCount: Scalars['Int']['output'];
};

export type Repo_RepositoryStatistics = {
  __typename?: 'Repo_RepositoryStatistics';
  /** Number of branches */
  branches: Scalars['Int']['output'];
  /** Number of contributors */
  contributors: Scalars['Int']['output'];
  /** Repository size in bytes */
  sizeInBytes: Scalars['Int']['output'];
  /** Number of tags */
  tags: Scalars['Int']['output'];
  /** Total number of commits */
  totalCommits: Scalars['Int']['output'];
};

export enum Repo_RepositoryType {
  Bare = 'BARE',
  Regular = 'REGULAR',
  Submodule = 'SUBMODULE',
  Worktree = 'WORKTREE'
}

export type Repo_ScanMetadata = {
  __typename?: 'Repo_ScanMetadata';
  /** Duration in milliseconds */
  duration: Scalars['Int']['output'];
  /** When the scan completed */
  endTime: Scalars['String']['output'];
  /** When the scan started */
  startTime: Scalars['String']['output'];
  /** Workspace root path */
  workspaceRoot: Scalars['String']['output'];
};

export type Repo_ScanStatistics = {
  __typename?: 'Repo_ScanStatistics';
  /** Changes grouped by type */
  changesByType: Repo_ChangesByType;
  /** Number of repositories with uncommitted changes */
  dirtyRepositories: Scalars['Int']['output'];
  /** Total additions across all repositories */
  totalAdditions: Scalars['Int']['output'];
  /** Total deletions across all repositories */
  totalDeletions: Scalars['Int']['output'];
  /** Total number of repositories */
  totalRepositories: Scalars['Int']['output'];
  /** Total number of uncommitted files */
  totalUncommittedFiles: Scalars['Int']['output'];
};

export type Repo_Stash = {
  __typename?: 'Repo_Stash';
  /** Stash index */
  index: Scalars['Int']['output'];
  /** Stash message */
  message: Scalars['String']['output'];
  /** When the stash was created */
  timestamp: Scalars['String']['output'];
};

export type Repo_Submodule = {
  __typename?: 'Repo_Submodule';
  /** Absolute path */
  absolutePath: Scalars['String']['output'];
  /** Current commit hash */
  hash: Scalars['String']['output'];
  /** Whether submodule is initialized */
  initialized: Scalars['Boolean']['output'];
  /** Submodule name */
  name: Scalars['String']['output'];
  /** Path relative to parent repository */
  path: Scalars['String']['output'];
  /** Git status if initialized */
  status: Maybe<Repo_GitStatus>;
  /** Submodule URL */
  url: Scalars['String']['output'];
};

export type Repo__Entity = Repo_Repository;

export type Repo__Service = {
  __typename?: 'Repo__Service';
  sdl: Maybe<Scalars['String']['output']>;
};

export enum Repo_Link__Purpose {
  /** `EXECUTION` features provide metadata necessary for operation execution. */
  Execution = 'EXECUTION',
  /** `SECURITY` features provide metadata necessary to securely resolve fields. */
  Security = 'SECURITY'
}

export type RepositoryWithAnalysis = {
  __typename?: 'RepositoryWithAnalysis';
  /** Active Claude sessions for this repo */
  activeSessions: Array<Claude_ClaudeSession>;
  /** Repository git status */
  gitStatus: Repo_GitStatus;
  /** Recent analyses */
  recentAnalyses: Array<Claude_AgentRun>;
};

export type ServiceHealth = {
  __typename?: 'ServiceHealth';
  /** Health status */
  healthy: Scalars['Boolean']['output'];
  /** Service name */
  name: Scalars['String']['output'];
  /** Response time in ms */
  responseTime: Scalars['Float']['output'];
  /** Service version */
  version: Maybe<Scalars['String']['output']>;
};

export type Subscription = {
  __typename?: 'Subscription';
  /** Subscribe to progress updates for agent runs */
  agentRunProgress: Claude_AgentRunProgress;
  /** Subscribe to run status changes */
  agentRunUpdates: Claude_AgentRun;
  /** Subscribe to all run updates */
  allAgentRunUpdates: Claude_AgentRun;
  /** Subscribe to aggregate progress for multiple runs */
  batchProgress: Claude_BatchProgress;
  /** Subscribe to real-time command output from a Claude session */
  commandOutput: Claude_CommandOutput;
};


export type SubscriptionAgentRunProgressArgs = {
  runId: Scalars['ID']['input'];
};


export type SubscriptionAgentRunUpdatesArgs = {
  runId: Scalars['ID']['input'];
};


export type SubscriptionBatchProgressArgs = {
  batchId: Scalars['ID']['input'];
};


export type SubscriptionCommandOutputArgs = {
  sessionId: Scalars['ID']['input'];
};

export type SystemHealth = {
  __typename?: 'SystemHealth';
  /** Overall system health */
  healthy: Scalars['Boolean']['output'];
  /** Individual service health */
  services: Array<ServiceHealth>;
  /** Current timestamp */
  timestamp: Scalars['String']['output'];
  /** System uptime */
  uptime: Scalars['Int']['output'];
};
