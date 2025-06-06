import React from 'react';
import { Loader2 } from 'lucide-react';

interface FullPageSpinnerProps {
  message?: string;
  submessage?: string;
}

export function FullPageSpinner({ message = 'Loading...', submessage }: FullPageSpinnerProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
      {/* Backdrop - covers everything except nav */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* Spinner Content */}
      <div className="relative z-10 flex flex-col items-center space-y-4 text-white">
        <Loader2 className="h-12 w-12 animate-spin" />
        <div className="text-center">
          <p className="text-lg font-medium">{message}</p>
          {submessage && (
            <p className="mt-1 text-sm text-gray-300">{submessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}