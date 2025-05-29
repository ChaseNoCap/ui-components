# Skeleton Loading Components

Professional loading skeleton components for the metaGOTHIC dashboard with shimmer animations and timeout handling.

## Components

### RepositoryCardSkeleton
A skeleton loader that matches the exact layout of the `RepositoryCard` component.

```tsx
import { RepositoryCardSkeleton } from '@chasenocap/ui-components';

<RepositoryCardSkeleton />
```

**Features:**
- Matches repository card dimensions exactly
- Shimmer animation effects
- Dark mode support
- Hover effects maintained

### MetricsOverviewSkeleton
A skeleton loader for the metrics overview grid.

```tsx
import { MetricsOverviewSkeleton } from '@chasenocap/ui-components';

<MetricsOverviewSkeleton />
```

**Features:**
- 6 skeleton cards in responsive grid
- Matches metrics card layout
- Shimmer animations on all elements

### WorkflowListSkeleton
A skeleton loader for the workflow list component.

```tsx
import { WorkflowListSkeleton } from '@chasenocap/ui-components';

<WorkflowListSkeleton />
```

**Features:**
- 10 workflow items with proper spacing
- Icon, text, and status placeholders
- Hover effects maintained

### LoadingTimeout
A wrapper component that handles loading states with automatic timeout.

```tsx
import { LoadingTimeout } from '@chasenocap/ui-components';

<LoadingTimeout 
  isLoading={loading}
  timeout={30000}
  onTimeout={() => console.warn('Loading timed out')}
>
  {loading ? <SkeletonComponent /> : <RealComponent />}
</LoadingTimeout>
```

**Props:**
- `isLoading: boolean` - Loading state
- `timeout?: number` - Timeout in milliseconds (default: 30000)
- `onTimeout?: () => void` - Callback when timeout occurs
- `fallback?: ReactNode` - Custom timeout fallback component

### Shimmer Components
Utility components for creating custom shimmer effects.

```tsx
import { Shimmer, ShimmerSkeleton } from '@chasenocap/ui-components';

<Shimmer width="w-32" height="h-4" />
<ShimmerSkeleton width="w-full" height="h-8" />
```

## Usage with React Query

The skeleton components are designed to work seamlessly with React Query loading states:

```tsx
import { useQuery } from '@tanstack/react-query';
import { 
  RepositoryCardSkeleton, 
  LoadingTimeout 
} from '@chasenocap/ui-components';

const MyComponent = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['repositories'],
    queryFn: fetchRepositories,
  });

  return (
    <LoadingTimeout isLoading={isLoading} timeout={30000}>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <RepositoryCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.map((repo) => (
            <RepositoryCard key={repo.id} repository={repo} />
          ))}
        </div>
      )}
    </LoadingTimeout>
  );
};
```

## Design Principles

1. **Exact Layout Matching**: Skeletons match the real components' dimensions exactly
2. **Professional Animations**: Subtle shimmer effects using CSS gradients
3. **Dark Mode Support**: All components work in both light and dark themes
4. **Performance Optimized**: Minimal re-renders and efficient animations
5. **Accessibility**: Proper ARIA attributes and semantic structure
6. **Timeout Handling**: Automatic fallback after configurable timeout periods

## Styling

All skeleton components use Tailwind CSS classes and follow the dashboard's design system:

- **Background**: `bg-white dark:bg-gray-800`
- **Shimmer**: Gradient from `gray-200` to `gray-300` (light) / `gray-700` to `gray-600` (dark)
- **Animations**: `animate-pulse` for basic pulsing, custom `animate-shimmer` for advanced effects
- **Spacing**: Matches real components exactly

## Testing

Run the skeleton component tests:

```bash
npm test src/components/Skeleton/Skeleton.test.tsx
```

## Demo

Use the `SkeletonDemo` component to see all skeleton components in action:

```tsx
import { SkeletonDemo } from '@chasenocap/ui-components';

<SkeletonDemo />
```

The demo includes:
- Toggle between skeleton and real content
- Timeout demonstration (5 seconds)
- All skeleton components showcased
- Interactive controls for testing

## Browser Support

The skeleton components work in all modern browsers with CSS gradient support:
- Chrome 26+
- Firefox 16+
- Safari 7+
- Edge 12+

## Performance Notes

- Skeleton components render immediately (no loading delay)
- CSS animations are hardware-accelerated
- Minimal JavaScript overhead
- Efficient React rendering patterns
- No external dependencies beyond React and Tailwind CSS