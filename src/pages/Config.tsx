import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { useToast } from '../components/Toast/useToast';
import { Loader2, Save, RotateCcw } from 'lucide-react';

interface ParallelismConfig {
  concurrentAgents: number;
  concurrentShells: number;
  enableParallelGit: boolean;
  batchSize: number;
}

interface AutomationConfig {
  autoCommit: boolean;
  autoPush: boolean;
  autoRetry: boolean;
  maxRetries: number;
  skipConfirmations: boolean;
}

interface UserConfig {
  id: string;
  parallelism: ParallelismConfig;
  automation: AutomationConfig;
  createdAt: string;
  updatedAt: string;
}

const Config: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Load configuration on mount
  useEffect(() => {
    loadConfig();
  }, []);

  // Save configuration with debouncing
  useEffect(() => {
    if (!isDirty || !config) return;

    const timeoutId = setTimeout(() => {
      saveConfig();
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(timeoutId);
  }, [config, isDirty]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      // TODO: Replace with GraphQL query when server is ready
      const stored = localStorage.getItem('meta-gothic-user-config');
      if (stored) {
        setConfig(JSON.parse(stored));
      } else {
        // Default configuration
        const defaultConfig: UserConfig = {
          id: 'default',
          parallelism: {
            concurrentAgents: 3,
            concurrentShells: 5,
            enableParallelGit: true,
            batchSize: 5,
          },
          automation: {
            autoCommit: false,
            autoPush: false,
            autoRetry: true,
            maxRetries: 3,
            skipConfirmations: false,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setConfig(defaultConfig);
      }
    } catch (error) {
      toast({
        title: 'Error loading configuration',
        description: 'Failed to load user preferences',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    try {
      setSaving(true);
      // TODO: Replace with GraphQL mutation when server is ready
      localStorage.setItem('meta-gothic-user-config', JSON.stringify(config));
      setIsDirty(false);
      toast({
        title: 'Configuration saved',
        description: 'Your preferences have been saved',
      });
    } catch (error) {
      toast({
        title: 'Error saving configuration',
        description: 'Failed to save user preferences',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (updates: Partial<UserConfig>) => {
    if (!config) return;
    
    setConfig({
      ...config,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    setIsDirty(true);
  };

  const updateParallelism = (updates: Partial<ParallelismConfig>) => {
    if (!config) return;
    
    updateConfig({
      parallelism: {
        ...config.parallelism,
        ...updates,
      },
    });
  };

  const updateAutomation = (updates: Partial<AutomationConfig>) => {
    if (!config) return;
    
    updateConfig({
      automation: {
        ...config.automation,
        ...updates,
      },
    });
  };

  const resetToDefaults = () => {
    const defaultConfig: UserConfig = {
      id: 'default',
      parallelism: {
        concurrentAgents: 3,
        concurrentShells: 5,
        enableParallelGit: true,
        batchSize: 5,
      },
      automation: {
        autoCommit: false,
        autoPush: false,
        autoRetry: true,
        maxRetries: 3,
        skipConfirmations: false,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setConfig(defaultConfig);
    setIsDirty(true);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Failed to load configuration</p>
          <Button onClick={loadConfig} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Configuration</h1>
          <p className="text-muted-foreground mt-2">
            Manage your metaGOTHIC framework preferences
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          <Button
            variant="outline"
            size="sm"
            onClick={resetToDefaults}
            disabled={saving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Parallelism Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Parallelism Settings</CardTitle>
            <CardDescription>
              Configure concurrent execution limits for optimal performance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="concurrent-agents">
                  Concurrent Claude Agents (1-10)
                </Label>
                <Input
                  id="concurrent-agents"
                  type="number"
                  min={1}
                  max={10}
                  value={config.parallelism.concurrentAgents}
                  onChange={(e) => {
                    const value = Math.min(10, Math.max(1, parseInt(e.target.value) || 1));
                    updateParallelism({ concurrentAgents: value });
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  Number of Claude agents that can run simultaneously
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="concurrent-shells">
                  Concurrent Shell Processes (1-20)
                </Label>
                <Input
                  id="concurrent-shells"
                  type="number"
                  min={1}
                  max={20}
                  value={config.parallelism.concurrentShells}
                  onChange={(e) => {
                    const value = Math.min(20, Math.max(1, parseInt(e.target.value) || 1));
                    updateParallelism({ concurrentShells: value });
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  Number of shell processes that can run simultaneously
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enable-parallel-git">Enable Parallel Git Operations</Label>
                  <p className="text-sm text-muted-foreground">
                    Execute git commands across multiple repositories simultaneously
                  </p>
                </div>
                <Switch
                  id="enable-parallel-git"
                  checked={config.parallelism.enableParallelGit}
                  onCheckedChange={(checked) => 
                    updateParallelism({ enableParallelGit: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="batch-size">
                  Batch Size (1-20)
                </Label>
                <Input
                  id="batch-size"
                  type="number"
                  min={1}
                  max={20}
                  value={config.parallelism.batchSize}
                  onChange={(e) => {
                    const value = Math.min(20, Math.max(1, parseInt(e.target.value) || 1));
                    updateParallelism({ batchSize: value });
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  Number of repositories to process in each batch
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Automation Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Automation Settings</CardTitle>
            <CardDescription>
              Control automatic behaviors and confirmations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-commit">Auto-commit Changes</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically commit changes after successful operations
                  </p>
                </div>
                <Switch
                  id="auto-commit"
                  checked={config.automation.autoCommit}
                  onCheckedChange={(checked) => 
                    updateAutomation({ autoCommit: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-push">Auto-push Commits</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically push commits to remote repository
                  </p>
                </div>
                <Switch
                  id="auto-push"
                  checked={config.automation.autoPush}
                  onCheckedChange={(checked) => 
                    updateAutomation({ autoPush: checked })
                  }
                  disabled={!config.automation.autoCommit}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-retry">Auto-retry Failed Operations</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically retry operations that fail
                  </p>
                </div>
                <Switch
                  id="auto-retry"
                  checked={config.automation.autoRetry}
                  onCheckedChange={(checked) => 
                    updateAutomation({ autoRetry: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-retries">
                  Maximum Retries (0-10)
                </Label>
                <Input
                  id="max-retries"
                  type="number"
                  min={0}
                  max={10}
                  value={config.automation.maxRetries}
                  onChange={(e) => {
                    const value = Math.min(10, Math.max(0, parseInt(e.target.value) || 0));
                    updateAutomation({ maxRetries: value });
                  }}
                  disabled={!config.automation.autoRetry}
                />
                <p className="text-sm text-muted-foreground">
                  Number of times to retry failed operations
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="skip-confirmations">Skip Confirmations</Label>
                  <p className="text-sm text-muted-foreground">
                    Skip confirmation dialogs for automated operations
                  </p>
                </div>
                <Switch
                  id="skip-confirmations"
                  checked={config.automation.skipConfirmations}
                  onCheckedChange={(checked) => 
                    updateAutomation({ skipConfirmations: checked })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Keyboard Shortcuts */}
        <Card>
          <CardHeader>
            <CardTitle>Keyboard Shortcuts</CardTitle>
            <CardDescription>
              Quick access to common actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Open Configuration</span>
                <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">
                  ⌘ ,
                </kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Save Configuration</span>
                <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">
                  ⌘ S
                </kbd>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Config;