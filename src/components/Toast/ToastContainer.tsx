import React from 'react';
import { Toast, ToastProps } from './Toast';

interface ToastContainerProps {
  toasts: ToastProps[];
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  position = 'top-right',
}) => {
  const positionClasses = {
    'top-right': 'top-0 right-0 pt-4 pr-4',
    'top-left': 'top-0 left-0 pt-4 pl-4',
    'bottom-right': 'bottom-0 right-0 pb-4 pr-4',
    'bottom-left': 'bottom-0 left-0 pb-4 pl-4',
    'top-center': 'top-0 left-1/2 -translate-x-1/2 pt-4',
    'bottom-center': 'bottom-0 left-1/2 -translate-x-1/2 pb-4',
  };

  return (
    <div
      aria-live="assertive"
      className={`pointer-events-none fixed z-50 flex flex-col ${position.includes('center') ? 'items-center' : position.includes('left') ? 'items-start' : 'items-end'} gap-3 ${positionClasses[position]}`}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  );
};