import React, { createContext, useContext, useState, useCallback } from 'react';
import { FullPageSpinner } from '@/components/LoadingStates/FullPageSpinner';

interface SpinnerState {
  isVisible: boolean;
  message: string;
  submessage?: string;
}

interface FullPageSpinnerContextType {
  show: (message?: string, submessage?: string) => void;
  hide: () => void;
  update: (message: string, submessage?: string) => void;
}

const FullPageSpinnerContext = createContext<FullPageSpinnerContextType | undefined>(undefined);

export function FullPageSpinnerProvider({ children }: { children: React.ReactNode }) {
  const [spinnerState, setSpinnerState] = useState<SpinnerState>({
    isVisible: false,
    message: 'Loading...',
    submessage: undefined
  });

  const show = useCallback((message = 'Loading...', submessage?: string) => {
    setSpinnerState({
      isVisible: true,
      message,
      submessage
    });
  }, []);

  const hide = useCallback(() => {
    setSpinnerState(prev => ({ ...prev, isVisible: false }));
  }, []);

  const update = useCallback((message: string, submessage?: string) => {
    setSpinnerState(prev => ({
      ...prev,
      message,
      submessage
    }));
  }, []);

  return (
    <FullPageSpinnerContext.Provider value={{ show, hide, update }}>
      {children}
      {spinnerState.isVisible && (
        <FullPageSpinner 
          message={spinnerState.message} 
          submessage={spinnerState.submessage} 
        />
      )}
    </FullPageSpinnerContext.Provider>
  );
}

export function useFullPageSpinner() {
  const context = useContext(FullPageSpinnerContext);
  if (!context) {
    throw new Error('useFullPageSpinner must be used within a FullPageSpinnerProvider');
  }
  return context;
}