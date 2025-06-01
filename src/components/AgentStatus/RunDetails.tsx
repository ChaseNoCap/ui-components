import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import clsx from 'clsx';
import { format } from 'date-fns';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  RotateCcw, 
  Copy, 
  ChevronDown,
  ChevronRight,
  FileText,
  Terminal,
  AlertTriangle,
  Zap
} from 'lucide-react';

interface AgentRun {
  id: string;
  repository: string;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  input: AgentInput;
  output?: AgentOutput;
  error?: RunError;
  retryCount: number;
  parentRunId?: string;
}

enum RunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  RETRYING = 'RETRYING',
}

interface AgentInput {
  prompt: string;
  diff: string;
  recentCommits: string[];
  model: string;
  temperature: number;
}

interface AgentOutput {
  message: string;
  confidence: number;
  reasoning?: string;
  rawResponse: string;
  tokensUsed: number;
}

interface RunError {
  code: string;
  message: string;
  stackTrace?: string;
  recoverable: boolean;
}

interface RunDetailsProps {
  run: AgentRun;
  onRetry: () => void;
}

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ 
  title, 
  icon,
  defaultOpen = false, 
  children 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{title}</span>
        </div>
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {isOpen && (
        <div className="px-4 py-3 border-t">
          {children}
        </div>
      )}
    </div>
  );
};

export const RunDetails: React.FC<RunDetailsProps> = ({ run, onRetry }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getStatusIcon = (status: RunStatus) => {
    switch (status) {
      case RunStatus.QUEUED:
        return <Clock className="h-5 w-5" />;
      case RunStatus.RUNNING:
        return <Loader2 className="h-5 w-5 animate-spin" />;
      case RunStatus.SUCCESS:
        return <CheckCircle className="h-5 w-5" />;
      case RunStatus.FAILED:
        return <XCircle className="h-5 w-5" />;
      case RunStatus.CANCELLED:
        return <AlertCircle className="h-5 w-5" />;
      case RunStatus.RETRYING:
        return <RotateCcw className="h-5 w-5" />;
    }
  };

  const getStatusColor = (status: RunStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case RunStatus.QUEUED:
        return 'default';
      case RunStatus.RUNNING:
        return 'secondary';
      case RunStatus.SUCCESS:
        return 'outline';
      case RunStatus.FAILED:
        return 'destructive';
      case RunStatus.CANCELLED:
        return 'secondary';
      case RunStatus.RETRYING:
        return 'secondary';
      default:
        return 'default';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <Card className="h-[calc(100vh-300px)] overflow-y-auto">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">{run.repository}</CardTitle>
            <CardDescription className="mt-1">
              Run ID: {run.id.slice(0, 8)}...
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(run.id, 'runId')}
                className="ml-1 h-5 w-5 p-0"
              >
                {copiedId === 'runId' ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </CardDescription>
          </div>
          <Badge variant={getStatusColor(run.status)} className="flex items-center gap-1">
            {getStatusIcon(run.status)}
            <span>{run.status}</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Metadata */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Started</p>
            <p className="text-sm font-medium">
              {format(new Date(run.startedAt), 'MMM d, yyyy HH:mm:ss')}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Duration</p>
            <p className="text-sm font-medium">{formatDuration(run.duration)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Tokens Used</p>
            <p className="text-sm font-medium">
              {run.output?.tokensUsed || '-'}
            </p>
          </div>
        </div>

        {/* Tabs for different sections */}
        <Tabs defaultValue="output" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="output">Output</TabsTrigger>
            <TabsTrigger value="input">Input</TabsTrigger>
            <TabsTrigger value="raw">Raw Response</TabsTrigger>
            {run.error && <TabsTrigger value="error">Error</TabsTrigger>}
          </TabsList>

          <TabsContent value="output" className="space-y-3">
            {run.output ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Generated Message</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(run.output!.message, 'message')}
                    >
                      {copiedId === 'message' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <pre className="bg-green-50 dark:bg-green-950 p-4 rounded-lg overflow-x-auto">
                    <code className="text-sm">{run.output.message}</code>
                  </pre>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Confidence:</span>
                    <Badge variant="outline">
                      {(run.output.confidence * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>

                {run.output.reasoning && (
                  <CollapsibleSection title="Reasoning" icon={<Zap className="h-4 w-4" />}>
                    <p className="text-sm">{run.output.reasoning}</p>
                  </CollapsibleSection>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No output available
              </div>
            )}
          </TabsContent>

          <TabsContent value="input" className="space-y-3">
            <CollapsibleSection title="Prompt" icon={<FileText className="h-4 w-4" />} defaultOpen>
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto max-h-96">
                <code className="text-sm">{run.input.prompt}</code>
              </pre>
            </CollapsibleSection>

            <CollapsibleSection title="Git Diff" icon={<Terminal className="h-4 w-4" />}>
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto max-h-96">
                <code className="text-sm">{run.input.diff || 'No diff available'}</code>
              </pre>
            </CollapsibleSection>

            <CollapsibleSection title="Recent Commits" icon={<Terminal className="h-4 w-4" />}>
              <div className="space-y-2">
                {run.input.recentCommits.map((commit, i) => (
                  <div key={i} className="text-sm font-mono bg-gray-100 dark:bg-gray-900 p-2 rounded">
                    {commit}
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <p className="text-sm text-muted-foreground">Model</p>
                <p className="text-sm font-medium">{run.input.model}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Temperature</p>
                <p className="text-sm font-medium">{run.input.temperature}</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="raw" className="space-y-3">
            {run.output?.rawResponse ? (
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto max-h-[500px]">
                <code className="text-xs">{run.output.rawResponse}</code>
              </pre>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No raw response available
              </div>
            )}
          </TabsContent>

          {run.error && (
            <TabsContent value="error" className="space-y-3">
              <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-red-800 dark:text-red-200">
                      {run.error.code}
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {run.error.message}
                    </p>
                  </div>
                </div>

                {run.error.stackTrace && (
                  <CollapsibleSection title="Stack Trace" icon={<Terminal className="h-4 w-4" />}>
                    <pre className="text-xs overflow-x-auto">
                      <code>{run.error.stackTrace}</code>
                    </pre>
                  </CollapsibleSection>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <Badge variant={run.error.recoverable ? 'outline' : 'destructive'}>
                    {run.error.recoverable ? 'Recoverable' : 'Non-recoverable'}
                  </Badge>
                  {run.error.recoverable && (
                    <Button
                      size="sm"
                      onClick={onRetry}
                      className="ml-auto"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Retry Run
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {run.retryCount > 0 && (
              <span>Retry attempt #{run.retryCount}</span>
            )}
            {run.parentRunId && (
              <span className="ml-2">
                (Parent: {run.parentRunId.slice(0, 8)}...)
              </span>
            )}
          </div>
          
          <div className="flex gap-2">
            {run.status === RunStatus.FAILED && run.error?.recoverable && (
              <Button
                onClick={onRetry}
                variant="default"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry Run
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Helper component - need to add this to the imports
const Label: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={clsx('text-sm font-medium', className)}>{children}</div>
);