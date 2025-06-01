import React from 'react';
import clsx from 'clsx';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success';
}


// Tailwind-based badge
export const TailwindBadge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-blue-100 text-blue-800 border-blue-200',
      secondary: 'bg-gray-100 text-gray-800 border-gray-200',
      destructive: 'bg-red-100 text-red-800 border-red-200',
      outline: 'bg-white text-gray-800 border-gray-300',
      success: 'bg-green-100 text-green-800 border-green-200',
    };
    
    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

TailwindBadge.displayName = 'TailwindBadge';

// Export Badge as alias to TailwindBadge
export const Badge = TailwindBadge;