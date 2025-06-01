// Toast utility functions for easy access
let toastInstance: any = null;

export const setToastInstance = (instance: any) => {
  toastInstance = instance;
};

export const toast = {
  success: (message: string, options?: any) => {
    if (toastInstance) {
      toastInstance.success(message, options);
    } else {
      console.log('Toast success:', message);
    }
  },
  error: (message: string, options?: any) => {
    if (toastInstance) {
      toastInstance.error(message, options);
    } else {
      console.error('Toast error:', message);
    }
  },
  info: (message: string, options?: any) => {
    if (toastInstance) {
      toastInstance.info(message, options);
    } else {
      console.info('Toast info:', message);
    }
  },
  warning: (message: string, options?: any) => {
    if (toastInstance) {
      toastInstance.warning(message, options);
    } else {
      console.warn('Toast warning:', message);
    }
  }
};