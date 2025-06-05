import { useEffect } from 'react';
import { setToastInstance } from '../../lib/toast';
import { useToastContext } from './ToastProvider';

/**
 * Connects the global toast utility to the ToastProvider context
 * This allows the use of the simple toast.success() API throughout the app
 */
export const ToastConnector: React.FC = () => {
  const toastContext = useToastContext();
  
  useEffect(() => {
    // Create an adapter that matches the global toast API
    const toastAdapter = {
      success: (message: string) => toastContext.showSuccess(message),
      error: (message: string) => toastContext.showError(message),
      info: (message: string) => toastContext.showInfo(message),
      warning: (message: string) => toastContext.showWarning(message),
    };
    
    // Connect the global toast to our context
    setToastInstance(toastAdapter);
    
    // Cleanup on unmount
    return () => {
      setToastInstance(null);
    };
  }, [toastContext]);
  
  return null;
};