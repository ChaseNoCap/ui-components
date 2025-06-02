// Settings service for managing user preferences
interface ModalSettings {
  autoClose: boolean;
  autoCloseDelay: number; // in milliseconds
}

interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  modalSettings: {
    graphqlProgress: ModalSettings;
  };
  // Add more settings here as needed
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  modalSettings: {
    graphqlProgress: {
      autoClose: false,
      autoCloseDelay: 3000
    }
  }
};

class SettingsService {
  private static STORAGE_KEY = 'meta-gothic-settings';
  
  getSettings(): UserSettings {
    try {
      const stored = localStorage.getItem(SettingsService.STORAGE_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        // Force auto-close to false if it was previously true (one-time migration)
        if (settings.modalSettings?.graphqlProgress?.autoClose === true) {
          settings.modalSettings.graphqlProgress.autoClose = false;
          this.saveSettings(settings);
        }
        // Merge with defaults to ensure all properties exist
        return this.mergeSettings(DEFAULT_SETTINGS, settings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
    return DEFAULT_SETTINGS;
  }
  
  saveSettings(settings: UserSettings): void {
    try {
      localStorage.setItem(SettingsService.STORAGE_KEY, JSON.stringify(settings));
      // Emit custom event so other components can react
      window.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }
  
  updateModalSettings(type: keyof UserSettings['modalSettings'], settings: Partial<ModalSettings>): void {
    const current = this.getSettings();
    current.modalSettings[type] = {
      ...current.modalSettings[type],
      ...settings
    };
    this.saveSettings(current);
  }
  
  getModalSettings(type: keyof UserSettings['modalSettings']): ModalSettings {
    return this.getSettings().modalSettings[type];
  }
  
  private mergeSettings(defaults: UserSettings, saved: Partial<UserSettings>): UserSettings {
    return {
      ...defaults,
      ...saved,
      modalSettings: {
        ...defaults.modalSettings,
        ...saved.modalSettings
      }
    };
  }
}

export const settingsService = new SettingsService();
export type { UserSettings, ModalSettings };