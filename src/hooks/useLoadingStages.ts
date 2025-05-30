import { useState, useCallback } from 'react';
import { LoadingStage } from '../components/LoadingStates/LoadingModal';

export const useLoadingStages = (initialStages: Omit<LoadingStage, 'status'>[]) => {
  const [stages, setStages] = useState<LoadingStage[]>(
    initialStages.map(stage => ({ ...stage, status: 'pending' as const }))
  );

  const updateStage = useCallback((id: string, update: Partial<LoadingStage>) => {
    setStages(prev => prev.map(stage => 
      stage.id === id ? { ...stage, ...update } : stage
    ));
  }, []);

  const setStageStatus = useCallback((id: string, status: LoadingStage['status'], message?: string, error?: string) => {
    updateStage(id, { status, message, error });
  }, [updateStage]);

  const reset = useCallback(() => {
    setStages(prev => prev.map(stage => ({ 
      ...stage, 
      status: 'pending' as const, 
      message: undefined, 
      error: undefined 
    })));
  }, []);

  const isLoading = stages.some(stage => stage.status === 'loading');
  const isComplete = stages.every(stage => stage.status === 'success');
  const hasError = stages.some(stage => stage.status === 'error');

  return {
    stages,
    updateStage,
    setStageStatus,
    reset,
    isLoading,
    isComplete,
    hasError,
  };
};