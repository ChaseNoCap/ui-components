import React from 'react';

interface SkeletonLoaderProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
  width?: string | number;
  height?: string | number;
  count?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  className = '',
  variant = 'rect',
  width = '100%',
  height = 20,
  count = 1,
}) => {
  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-gray-700';
  
  const variantClasses = {
    text: 'rounded',
    rect: 'rounded-md',
    circle: 'rounded-full',
  };

  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`${baseClasses} ${variantClasses[variant]} ${className} ${
            index > 0 ? 'mt-2' : ''
          }`}
          style={style}
          aria-hidden="true"
        />
      ))}
    </>
  );
};

export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
    <SkeletonLoader variant="text" height={24} width="60%" className="mb-4" />
    <SkeletonLoader variant="rect" height={40} className="mb-3" />
    <SkeletonLoader variant="text" height={16} count={3} />
  </div>
);

export const TableRowSkeleton: React.FC<{ columns: number; className?: string }> = ({ 
  columns, 
  className = '' 
}) => (
  <tr className={className}>
    {Array.from({ length: columns }).map((_, index) => (
      <td key={index} className="px-6 py-4">
        <SkeletonLoader variant="text" height={16} />
      </td>
    ))}
  </tr>
);