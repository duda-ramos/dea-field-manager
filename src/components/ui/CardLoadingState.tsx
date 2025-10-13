import { Skeleton } from './skeleton';
import { Card, CardContent, CardHeader } from './card';

/**
 * Loading skeleton for card components
 * Use this for consistent skeleton loading in card-based layouts
 */
export function CardLoadingState() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for a grid of cards
 */
interface CardGridLoadingStateProps {
  count?: number;
  columns?: 1 | 2 | 3 | 4;
}

export function CardGridLoadingState({ 
  count = 6,
  columns = 3 
}: CardGridLoadingStateProps) {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
  };

  return (
    <div className={`grid gap-4 ${gridClasses[columns]}`}>
      {Array.from({ length: count }).map((_, i) => (
        <CardLoadingState key={i} />
      ))}
    </div>
  );
}
