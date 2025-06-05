import React, { useEffect, useState } from 'react';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { settingsService } from '../services/settingsService';

export const ConditionalDevTools: React.FC = () => {
  const [showDevTools, setShowDevTools] = useState(false);
  
  useEffect(() => {
    const checkSettings = () => {
      const settings = settingsService.getSettings();
      const isProduction = process.env.NODE_ENV === 'production';
      
      // Show only if: NOT in production AND debug is enabled in config
      setShowDevTools(!isProduction && settings.debugOptions.showTanStackDevTools);
    };
    
    // Check initial settings
    checkSettings();
    
    // Listen for changes
    const handleSettingsChange = () => checkSettings();
    window.addEventListener('settings-changed', handleSettingsChange);
    
    return () => {
      window.removeEventListener('settings-changed', handleSettingsChange);
    };
  }, []);
  
  if (!showDevTools) {
    return null;
  }
  
  return <ReactQueryDevtools initialIsOpen={false} />;
};