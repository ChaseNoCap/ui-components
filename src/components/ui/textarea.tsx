import React from 'react';
import clsx from 'clsx';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}


// Tailwind-based textarea
export const TailwindTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={clsx(
          'flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

TailwindTextarea.displayName = 'TailwindTextarea';

// Export Textarea as alias to TailwindTextarea
export const Textarea = TailwindTextarea;