import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { Button } from '../components/ui/button';
import { useToast } from '../components/Toast/useToast';
import { Loader2, Save, RotateCcw } from 'lucide-react';
import { settingsService } from '../services/settingsService';

interface UIConfig {
  modalAutoClose: boolean;
  modalAutoCloseDelay: number;
}

interface UserConfig {
  id: string;
  ui: UIConfig;
  createdAt: string;
  updatedAt: string;
}

const Config: React.FC = () => {
  const { showError, showSuccess } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [debugSettings, setDebugSettings] = useState(settingsService.getSettings().debugOptions);

  // Load configuration on mount
  useEffect(() => {
    loadConfig();
  }, []);

  // Listen for settings changes
  useEffect(() => {
    const handleSettingsChange = () => {
      setDebugSettings(settingsService.getSettings().debugOptions);
    };
    
    window.addEventListener('settings-changed', handleSettingsChange);
    return () => window.removeEventListener('settings-changed', handleSettingsChange);
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
        const parsedConfig = JSON.parse(stored);
        // Migrate from old config format
        const migratedConfig: UserConfig = {
          id: parsedConfig.id || 'default',
          ui: parsedConfig.ui || {
            modalAutoClose: false,
            modalAutoCloseDelay: 3000,
          },
          createdAt: parsedConfig.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setConfig(migratedConfig);
        
        // Sync with settings service on load
        settingsService.updateModalSettings('graphqlProgress', {
          autoClose: migratedConfig.ui.modalAutoClose,
          autoCloseDelay: migratedConfig.ui.modalAutoCloseDelay,
        });
      } else {
        // Load from settings service as fallback
        const modalSettings = settingsService.getModalSettings('graphqlProgress');
        const defaultConfig: UserConfig = {
          id: 'default',
          ui: {
            modalAutoClose: modalSettings.autoClose,
            modalAutoCloseDelay: modalSettings.autoCloseDelay,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setConfig(defaultConfig);
      }
    } catch (error) {
      showError('Error loading configuration', 'Failed to load user preferences');
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
      
      // Also update the settings service for UI settings
      settingsService.updateModalSettings('graphqlProgress', {
        autoClose: config.ui.modalAutoClose,
        autoCloseDelay: config.ui.modalAutoCloseDelay,
      });
      
      setIsDirty(false);
      showSuccess('Configuration saved', 'Your preferences have been saved');
    } catch (error) {
      showError('Error saving configuration', 'Failed to save user preferences');
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

  const updateUI = (updates: Partial<UIConfig>) => {
    if (!config) return;
    
    updateConfig({
      ui: {
        ...config.ui,
        ...updates,
      },
    });
  };

  const resetToDefaults = () => {
    const defaultConfig: UserConfig = {
      id: 'default',
      ui: {
        modalAutoClose: false,
        modalAutoCloseDelay: 3000,
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
        {/* UI Settings */}
        <Card>
          <CardHeader>
            <CardTitle>UI Settings</CardTitle>
            <CardDescription>
              Configure user interface behaviors and preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="modal-auto-close">Auto-close Progress Modals</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically close GraphQL progress modals on successful completion
                  </p>
                </div>
                <Switch
                  id="modal-auto-close"
                  checked={config.ui.modalAutoClose}
                  onCheckedChange={(checked) => 
                    updateUI({ modalAutoClose: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="auto-close-delay">
                  Auto-close Delay (seconds)
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="auto-close-delay"
                    type="number"
                    min={1}
                    max={10}
                    step={0.5}
                    value={config.ui.modalAutoCloseDelay / 1000}
                    onChange={(e) => {
                      const seconds = Math.min(10, Math.max(1, parseFloat(e.target.value) || 3));
                      updateUI({ modalAutoCloseDelay: seconds * 1000 });
                    }}
                    disabled={!config.ui.modalAutoClose}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">
                    {config.ui.modalAutoCloseDelay / 1000} seconds
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Time to wait before automatically closing the modal (1-10 seconds)
                </p>
              </div>

              <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Note:</strong> Auto-close will not activate if errors are detected during the operation, 
                  allowing you to review and copy error messages.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Debug Options */}
        <Card>
          <CardHeader>
            <CardTitle>Developer Tools</CardTitle>
            <CardDescription>
              Enable debugging tools and performance monitoring (only visible in development mode)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="graphql-debug">GraphQL Debug Panel</Label>
                <p className="text-sm text-muted-foreground">
                  Shows GraphQL query debugger for testing queries
                </p>
              </div>
              <Switch
                id="graphql-debug"
                checked={debugSettings.showGraphQLDebug}
                onCheckedChange={(checked) => {
                  const settings = settingsService.getSettings();
                  settings.debugOptions.showGraphQLDebug = checked;
                  settingsService.saveSettings(settings);
                  setDebugSettings({ ...debugSettings, showGraphQLDebug: checked });
                }}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="tanstack-devtools">TanStack Query DevTools</Label>
                <p className="text-sm text-muted-foreground">
                  Shows React Query DevTools for REST API debugging
                </p>
              </div>
              <Switch
                id="tanstack-devtools"
                checked={debugSettings.showTanStackDevTools}
                onCheckedChange={(checked) => {
                  const settings = settingsService.getSettings();
                  settings.debugOptions.showTanStackDevTools = checked;
                  settingsService.saveSettings(settings);
                  setDebugSettings({ ...debugSettings, showTanStackDevTools: checked });
                }}
              />
            </div>
            
            {process.env.NODE_ENV === 'production' && (
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950 p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Note:</strong> Debug tools are disabled in production mode for security reasons.
                </p>
              </div>
            )}
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